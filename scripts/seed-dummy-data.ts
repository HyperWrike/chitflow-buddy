import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY in .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const dummySubscribers = [
  {
    access_code: "PCPL0001",
    name: "Anitha Raman",
    address_line1: "45, Nethaji Road",
    address_line2: "Apartment 2B",
    city: "Salem",
    pincode: "636001",
    whatsapp_number: "9842567890",
    alt_number: "9876543210",
    active: true,
  },
  {
    access_code: "PCPL0002",
    name: "Ramesh Kumar",
    address_line1: "78, Main Street",
    address_line2: "Above Krishna Store",
    city: "Salem",
    pincode: "636002",
    whatsapp_number: "9876543211",
    alt_number: null,
    active: true,
  },
  {
    access_code: "PCPL0003",
    name: "Priya Shankar",
    address_line1: "12, Periyar Nagar",
    address_line2: null,
    city: "Salem",
    pincode: "636003",
    whatsapp_number: "9765432109",
    alt_number: "8765432109",
    active: true,
  },
  {
    access_code: "PCPL0004",
    name: "Vikram Singh",
    address_line1: "89, Industrial Area",
    address_line2: "Unit 5",
    city: "Salem",
    pincode: "636004",
    whatsapp_number: "9654321098",
    alt_number: null,
    active: true,
  },
  {
    access_code: "PCPL0005",
    name: "Meera Reddy",
    address_line1: "34, Temple Road",
    address_line2: "Near Mariamman Kovil",
    city: "Salem",
    pincode: "636005",
    whatsapp_number: "9543210987",
    alt_number: "7543210987",
    active: true,
  },
  {
    access_code: "PCPL0006",
    name: "Arun Krishnan",
    address_line1: "56, Park Street",
    address_line2: "Flat 301",
    city: "Salem",
    pincode: "636001",
    whatsapp_number: "9432109876",
    alt_number: null,
    active: true,
  },
  {
    access_code: "PCPL0007",
    name: "Divya Verma",
    address_line1: "23, Business Park",
    address_line2: "Office Complex",
    city: "Salem",
    pincode: "636006",
    whatsapp_number: "9321098765",
    alt_number: "8321098765",
    active: true,
  },
  {
    access_code: "PCPL0008",
    name: "Suresh Iyer",
    address_line1: "67, Cotton Mills Road",
    address_line2: null,
    city: "Salem",
    pincode: "636007",
    whatsapp_number: "9210987654",
    alt_number: null,
    active: true,
  },
  {
    access_code: "PCPL0009",
    name: "Anjali Patel",
    address_line1: "90, College Road",
    address_line2: "Near Government School",
    city: "Salem",
    pincode: "636008",
    whatsapp_number: "9109876543",
    alt_number: "8109876543",
    active: true,
  },
  {
    access_code: "PCPL0010",
    name: "Rajesh Menon",
    address_line1: "11, Railway Nagar",
    address_line2: "Plot 42",
    city: "Salem",
    pincode: "636009",
    whatsapp_number: "9098765432",
    alt_number: null,
    active: true,
  },
];

const dummyGroups = [
  {
    group_code: "CHIT-A1",
    agreement_no: "AG-2026-001",
    chit_value: 100000,
    duration_months: 20,
    auction_day: 5,
    auction_time: "5:30 PM",
    commission_rate: 5,
    start_month: "2026-05",
    status: "active",
  },
  {
    group_code: "CHIT-B1",
    agreement_no: "AG-2026-002",
    chit_value: 250000,
    duration_months: 24,
    auction_day: 12,
    auction_time: "6:00 PM",
    commission_rate: 6,
    start_month: "2026-05",
    status: "active",
  },
  {
    group_code: "CHIT-C1",
    agreement_no: "AG-2026-003",
    chit_value: 500000,
    duration_months: 30,
    auction_day: 18,
    auction_time: "7:00 PM",
    commission_rate: 5,
    start_month: "2026-05",
    status: "active",
  },
];

const demoMemberships = [
  ["PCPL0001", "CHIT-A1", "Anitha Raman", 1],
  ["PCPL0001", "CHIT-B1", "Anitha Raman", 1],
  ["PCPL0002", "CHIT-A1", "Ramesh Kumar", 1],
  ["PCPL0003", "CHIT-B1", "Priya Shankar", 1],
  ["PCPL0004", "CHIT-C1", "Vikram Singh", 2],
  ["PCPL0005", "CHIT-A1", "Meera Reddy", 1],
  ["PCPL0006", "CHIT-B1", "Arun Krishnan", 1],
  ["PCPL0007", "CHIT-C1", "Divya Verma", 1],
  ["PCPL0008", "CHIT-A1", "Suresh Iyer", 1],
  ["PCPL0009", "CHIT-C1", "Anjali Patel", 1],
  ["PCPL0010", "CHIT-B1", "Rajesh Menon", 1],
];

async function getOrCreateSubscriber(subscriber: typeof dummySubscribers[number]) {
  const { data: existing } = await supabase
    .from("subscribers")
    .select("id")
    .eq("access_code", subscriber.access_code)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase.from("subscribers").insert(subscriber).select("id").single();
  if (error) throw error;
  return data.id;
}

async function getOrCreateGroup(group: typeof dummyGroups[number]) {
  const { data: existing } = await supabase
    .from("chit_groups")
    .select("id")
    .eq("group_code", group.group_code)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase.from("chit_groups").insert(group).select("id").single();
  if (error) throw error;
  return data.id;
}

async function ensureMembership(subscriberId: string, groupId: string, nameOnChit: string, seatCount: number) {
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("subscriber_id", subscriberId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({ subscriber_id: subscriberId, group_id: groupId, name_on_chit: nameOnChit, seat_count: seatCount, prized: false, active: true })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function seedData() {
  console.log("🌱 Seeding dummy subscriber data...");

  try {
    console.log("📋 Ensuring 10 subscribers, 3 groups, and memberships...");
    const subscriberIds = new Map<string, string>();
    const groupIds = new Map<string, string>();

    for (const subscriber of dummySubscribers) {
      subscriberIds.set(subscriber.access_code, await getOrCreateSubscriber(subscriber));
    }

    for (const group of dummyGroups) {
      groupIds.set(group.group_code, await getOrCreateGroup(group));
    }

    let memberships = 0;
    for (const [accessCode, groupCode, nameOnChit, seatCount] of demoMemberships) {
      const subscriberId = subscriberIds.get(accessCode);
      const groupId = groupIds.get(groupCode);
      if (!subscriberId || !groupId) continue;
      await ensureMembership(subscriberId, groupId, nameOnChit, seatCount);
      memberships += 1;
    }

    console.log(`✅ Seeded/verified ${dummySubscribers.length} subscribers, ${dummyGroups.length} groups, and ${memberships} memberships.`);
    console.log("\n📊 Dummy Subscribers:");
    dummySubscribers.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (${s.access_code}) - ${s.whatsapp_number}`));
    console.log("\n📊 Dummy Groups:");
    dummyGroups.forEach((g, i) => console.log(`  ${i + 1}. ${g.group_code} - ${g.chit_value}`));
    console.log("\n✨ Seeding complete!");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    console.error("\nHint: row-level security is blocking writes to the production tables. Use the embedded ChitSync workspace for sample data, or provide a service-role key if you want this script to write to Supabase.");
  }
}

seedData();
