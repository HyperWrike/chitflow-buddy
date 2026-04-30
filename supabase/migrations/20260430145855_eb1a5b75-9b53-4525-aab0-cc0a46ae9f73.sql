
-- Roles enum + user_roles table (security pattern)
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer function for role checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup; first user becomes admin, rest operator
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email);

  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Subscribers
CREATE TABLE public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT NOT NULL DEFAULT 'Salem',
  pincode TEXT,
  whatsapp_number TEXT NOT NULL,
  alt_number TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chit groups
CREATE TABLE public.chit_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code TEXT NOT NULL UNIQUE,
  agreement_no TEXT,
  chit_value NUMERIC(14,2) NOT NULL,
  duration_months INT NOT NULL,
  auction_day INT NOT NULL CHECK (auction_day BETWEEN 1 AND 31),
  auction_time TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 5,
  start_month TEXT,                             -- YYYY-MM
  status TEXT NOT NULL DEFAULT 'active',        -- active / completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscriptions (membership of a subscriber in a group)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.chit_groups(id) ON DELETE CASCADE,
  name_on_chit TEXT NOT NULL,
  seat_count INT NOT NULL DEFAULT 1 CHECK (seat_count > 0),
  prized BOOLEAN NOT NULL DEFAULT false,
  prized_month TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_subscriber ON public.subscriptions(subscriber_id);
CREATE INDEX idx_subscriptions_group ON public.subscriptions(group_id);

-- Monthly entries (auction result per group per month)
CREATE TABLE public.monthly_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chit_groups(id) ON DELETE CASCADE,
  month TEXT NOT NULL,                          -- YYYY-MM
  winning_bid NUMERIC(14,2) NOT NULL,
  company_commission NUMERIC(14,2) NOT NULL,
  prized_subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  entered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, month)
);
CREATE INDEX idx_monthly_entries_month ON public.monthly_entries(month);

-- Member dues (one row per subscription per monthly entry)
CREATE TABLE public.member_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  monthly_entry_id UUID NOT NULL REFERENCES public.monthly_entries(id) ON DELETE CASCADE,
  previous_bid NUMERIC(14,2),
  share_of_discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_installment NUMERIC(14,2) NOT NULL,
  chit_amount_due NUMERIC(14,2) NOT NULL,
  manual_override BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, monthly_entry_id)
);

-- Dispatch log
CREATE TABLE public.dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  statement_image_path TEXT,
  whatsapp_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending / sent / delivered / failed
  sent_at TIMESTAMPTZ,
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, month)
);
CREATE INDEX idx_dispatch_month ON public.dispatch_log(month);
CREATE INDEX idx_dispatch_status ON public.dispatch_log(status);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_subscribers_updated BEFORE UPDATE ON public.subscribers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON public.chit_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chit_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_log ENABLE ROW LEVEL SECURITY;

-- RLS: profiles - users see own
CREATE POLICY "Users see own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- RLS: user_roles - users see own role; admins manage all
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: business tables — any authenticated staff can read; only admins can write
-- (operators are read-only on data; both admins and operators can use dispatch)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['subscribers','chit_groups','subscriptions','monthly_entries','member_dues']) LOOP
    EXECUTE format('CREATE POLICY "Staff read %1$I" ON public.%1$I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "Admins insert %1$I" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),''admin''));', t);
    EXECUTE format('CREATE POLICY "Admins update %1$I" ON public.%1$I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),''admin''));', t);
    EXECUTE format('CREATE POLICY "Admins delete %1$I" ON public.%1$I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''));', t);
  END LOOP;
END $$;

-- dispatch_log — staff can read & write (so operators can trigger dispatch)
CREATE POLICY "Staff read dispatch" ON public.dispatch_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert dispatch" ON public.dispatch_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update dispatch" ON public.dispatch_log FOR UPDATE TO authenticated USING (true);
