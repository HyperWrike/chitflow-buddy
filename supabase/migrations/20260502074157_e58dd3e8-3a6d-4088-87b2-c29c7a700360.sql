
-- Extend member_dues with payment tracking
ALTER TABLE public.member_dues
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS payment_ref text,
  ADD COLUMN IF NOT EXISTS override_reason text;

-- Extend dispatch_log
ALTER TABLE public.dispatch_log
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'reminder',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS file_path text;

-- Templates
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('receipt','reminder')),
  is_default boolean NOT NULL DEFAULT false,
  color_scheme text NOT NULL DEFAULT 'navy',
  header_text text,
  footer_text text NOT NULL DEFAULT 'Watch your Investment grow with us',
  show_logo boolean NOT NULL DEFAULT true,
  show_diagram boolean NOT NULL DEFAULT true,
  html_content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read templates" ON public.templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert templates" ON public.templates
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update templates" ON public.templates
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete templates" ON public.templates
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER set_updated_at_templates BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL DEFAULT '',
  image_url text,
  audience text NOT NULL DEFAULT 'all',
  audience_ids uuid[],
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  total_sent int NOT NULL DEFAULT 0,
  total_delivered int NOT NULL DEFAULT 0,
  total_read int NOT NULL DEFAULT 0,
  total_failed int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert campaigns" ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operator'::app_role));
CREATE POLICY "Staff update campaigns" ON public.campaigns
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operator'::app_role));
CREATE POLICY "Admins delete campaigns" ON public.campaigns
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Company settings (singleton row)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id text PRIMARY KEY DEFAULT 'singleton',
  company_name text NOT NULL DEFAULT 'Panasuna Chits (P) Ltd.',
  address text NOT NULL DEFAULT '419/151-A, Chinnakadai St, I Agraharam, Salem 636001',
  phone text NOT NULL DEFAULT '9842567890',
  whatsapp_no text NOT NULL DEFAULT '9842567890',
  logo_url text,
  tagline text NOT NULL DEFAULT 'Watch your Investment grow with us',
  auction_time text NOT NULL DEFAULT '5:00 PM',
  wapi_key text,
  wapi_provider text NOT NULL DEFAULT 'aisensy',
  wapi_sender text,
  scheduler_time text NOT NULL DEFAULT '09:00',
  days_before_auction int NOT NULL DEFAULT 1,
  auto_send_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.company_settings (id) VALUES ('singleton')
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read settings" ON public.company_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.company_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER set_updated_at_company_settings BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit_log" ON public.audit_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Staff insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
