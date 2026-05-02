import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_PHONES = ['919444420367', '918885145807'];

const fakeUsers = [
  { name: "Rahul Sharma", addr1: "Flat 4B, Green View Apts", city: "Bangalore", pincode: "560034" },
  { name: "Priya Patel", addr1: "12/A, Navrangpura", city: "Ahmedabad", pincode: "380009" },
  { name: "Suresh Kumar", addr1: "No 5, Anna Salai", city: "Chennai", pincode: "600002" },
  { name: "Anita Desai", addr1: "B-22, Defence Colony", city: "New Delhi", pincode: "110024" },
  { name: "Vikram Singh", addr1: "45, Jubilee Hills", city: "Hyderabad", pincode: "500033" },
  { name: "Meera Reddy", addr1: "Villa 12, Palm Meadows", city: "Bangalore", pincode: "560066" },
  { name: "Arjun Nair", addr1: "1st Floor, MG Road", city: "Kochi", pincode: "682016" },
  { name: "Neha Gupta", addr1: "Sector 18, Vashi", city: "Mumbai", pincode: "400703" },
  { name: "Karthik Iyer", addr1: "Plot 88, Kothrud", city: "Pune", pincode: "411038" },
  { name: "Divya Menon", addr1: "101, Residency Road", city: "Bangalore", pincode: "560025" }
];

async function seed() {
  console.log("Starting DB Seed...");

  // 1. Create Subscribers
  const subscribers = [];
  for (let i = 0; i < fakeUsers.length; i++) {
    const user = fakeUsers[i];
    const sub = {
      id: uuidv4(),
      access_code: `TEST${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      name: user.name,
      address_line1: user.addr1,
      city: user.city,
      pincode: user.pincode,
      whatsapp_number: TEST_PHONES[i % 2], // alternate the 2 phone numbers
      active: true
    };
    const { data, error } = await supabase.from('subscribers').insert(sub).select().single();
    if (error) throw error;
    subscribers.push(data);
    console.log(`Created subscriber: ${sub.name} with number ${sub.whatsapp_number}`);
  }

  // 2. Create a Group
  const group = {
    id: uuidv4(),
    group_code: `TESTGRP-${Math.floor(Math.random() * 1000)}`,
    chit_value: 1000000, // 10 Lakhs
    duration_months: 20,
    auction_day: 5,
    auction_time: "4:00 PM",
    commission_rate: 5,
    start_month: "2023-01",
    status: "active"
  };
  const { data: grpData, error: grpErr } = await supabase.from('chit_groups').insert(group).select().single();
  if (grpErr) throw grpErr;
  console.log(`Created group: ${group.group_code}`);

  // 3. Add Subscriptions
  const subscriptions = [];
  for (const sub of subscribers) {
    const isPrized = Math.random() > 0.8;
    const subscription = {
      id: uuidv4(),
      subscriber_id: sub.id,
      group_id: grpData.id,
      name_on_chit: sub.name,
      seat_count: 1,
      prized: isPrized,
      prized_month: isPrized ? "2023-05" : null,
      active: true
    };
    const { data, error } = await supabase.from('subscriptions').insert(subscription).select().single();
    if (error) throw error;
    subscriptions.push(data);
  }
  console.log(`Added ${subscriptions.length} subscriptions to group.`);

  // 4. Create a Monthly Entry for June 2023
  const currentMonth = "2023-06";
  const monthlyEntry = {
    id: uuidv4(),
    group_id: grpData.id,
    month: currentMonth,
    winning_bid: 200000, // 2 Lakhs
    company_commission: 50000, // 5% of 10L
    locked: true
  };
  const { data: meData, error: meErr } = await supabase.from('monthly_entries').insert(monthlyEntry).select().single();
  if (meErr) throw meErr;
  console.log(`Created Monthly Entry for ${currentMonth}`);

  // 5. Generate Dues
  const baseInstallment = 50000;
  const perSeatDiscount = 15000;

  for (const s of subscriptions) {
    const chitAmountDue = s.prized ? baseInstallment : (baseInstallment - perSeatDiscount);
    
    const due = {
      id: uuidv4(),
      subscription_id: s.id,
      monthly_entry_id: meData.id,
      previous_bid: 0,
      share_of_discount: s.prized ? 0 : perSeatDiscount,
      base_installment: baseInstallment,
      chit_amount_due: chitAmountDue
    };
    await supabase.from('member_dues').insert(due);

    // 6. Create Dispatch Log Entry
    const log = {
      id: uuidv4(),
      subscriber_id: s.subscriber_id,
      month: currentMonth,
      whatsapp_number: s.subscriptions?.subscribers?.whatsapp_number || TEST_PHONES[subscriptions.indexOf(s) % 2],
      status: 'pending'
    };
    await supabase.from('dispatch_log').insert(log);
  }

  console.log("Successfully generated member dues and pending dispatch logs for all 10 members!");
}

seed().catch(err => {
  console.error("Seed error:", err);
});
