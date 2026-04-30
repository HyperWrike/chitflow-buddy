import { supabase } from "@/integrations/supabase/client";

export type Subscriber = {
  id: string;
  access_code: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  pincode: string | null;
  whatsapp_number: string;
  alt_number: string | null;
  active: boolean;
};

export type ChitGroup = {
  id: string;
  group_code: string;
  agreement_no: string | null;
  chit_value: number;
  duration_months: number;
  auction_day: number;
  auction_time: string | null;
  commission_rate: number;
  start_month: string | null;
  status: string;
};

export type Subscription = {
  id: string;
  subscriber_id: string;
  group_id: string;
  name_on_chit: string;
  seat_count: number;
  prized: boolean;
  prized_month: string | null;
  active: boolean;
};

export type MonthlyEntry = {
  id: string;
  group_id: string;
  month: string;
  winning_bid: number;
  company_commission: number;
  prized_subscription_id: string | null;
  locked: boolean;
};

export type MemberDue = {
  id: string;
  subscription_id: string;
  monthly_entry_id: string;
  share_of_discount: number;
  base_installment: number;
  chit_amount_due: number;
  manual_override: boolean;
};

export type DispatchEntry = {
  id: string;
  subscriber_id: string;
  month: string;
  status: string;
  whatsapp_number: string;
  sent_at: string | null;
  attempt_count: number;
  last_error: string | null;
};

export const db = supabase;
