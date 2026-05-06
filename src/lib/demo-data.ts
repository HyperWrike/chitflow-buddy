import type { ChitGroup, MonthlyEntry, Subscriber, Subscription } from "@/lib/db-types";

type DemoMonthlyEntry = MonthlyEntry & { month: string };

type DemoDispatch = {
  id: string;
  subscriber_id: string;
  type: string;
  month: string;
  whatsapp_number: string;
  status: string;
  sent_at: string | null;
};

type DemoStatement = {
  id: string;
  month: string;
  source: "seed" | "import";
  imported_at: string | null;
  subscriber_id: string;
  group_id: string;
  group_code: string;
  access_code: string;
  subscriber_name: string;
  whatsapp_number: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  pincode: string | null;
  auction_date: string | null;
  auction_time: string | null;
  agree_no: string | null;
  name_on_chit: string;
  prized: boolean;
  chit_value: number;
  previous_bid_amount: number | null;
  cc: number | null;
  share_of_discount: number | null;
  period_months: number | null;
  auction_day: number | null;
  chit_amount_after_incentive: number | null;
  seat_index?: number;
};

export type UpiSettings = {
  mode: "static" | "dynamic" | "none";
  upiId: string | null;       // for dynamic
  payeeName: string | null;   // for dynamic
  staticImage: string | null; // base64 data URL for static
};

export type ImportHistoryEntry = {
  id: string;
  importedAt: string;
  fileName: string;
  importedBy: string;
  added: number;
  skipped: number;
  appended: number;
};

type DemoState = {
  subscribers: Subscriber[];
  groups: ChitGroup[];
  subscriptions: Subscription[];
  monthlyEntries?: DemoMonthlyEntry[];
  dispatches?: DemoDispatch[];
  statements?: DemoStatement[];
  upi?: UpiSettings;
  importHistory?: ImportHistoryEntry[];
  customerCodeCounter?: number;
};

const DEMO_KEY = "panasuna_demo_state_v1";
const DEMO_EVENT = "panasuna:demo-changed";

export const subscribeDemoChanges = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  const storageHandler = (event: StorageEvent) => {
    if (event.key === DEMO_KEY) cb();
  };
  window.addEventListener(DEMO_EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(DEMO_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
};

const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `demo-${Math.random().toString(36).slice(2)}${Date.now()}`);

const seedState = (): DemoState => {
  const subscribers: Subscriber[] = [
    {
      id: makeId(),
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
    { id: makeId(), access_code: "PCPL0002", name: "Ramesh Kumar", address_line1: "78, Main Street", address_line2: "Above Krishna Store", city: "Salem", pincode: "636002", whatsapp_number: "9876543211", alt_number: null, active: true },
    { id: makeId(), access_code: "PCPL0003", name: "Priya Shankar", address_line1: "12, Periyar Nagar", address_line2: null, city: "Salem", pincode: "636003", whatsapp_number: "9765432109", alt_number: "8765432109", active: true },
    { id: makeId(), access_code: "PCPL0004", name: "Vikram Singh", address_line1: "89, Industrial Area", address_line2: "Unit 5", city: "Salem", pincode: "636004", whatsapp_number: "9654321098", alt_number: null, active: true },
    { id: makeId(), access_code: "PCPL0005", name: "Meera Reddy", address_line1: "34, Temple Road", address_line2: "Near Mariamman Kovil", city: "Salem", pincode: "636005", whatsapp_number: "9543210987", alt_number: "7543210987", active: true },
    { id: makeId(), access_code: "PCPL0006", name: "Arun Krishnan", address_line1: "56, Park Street", address_line2: "Flat 301", city: "Salem", pincode: "636001", whatsapp_number: "9432109876", alt_number: null, active: true },
    { id: makeId(), access_code: "PCPL0007", name: "Divya Verma", address_line1: "23, Business Park", address_line2: "Office Complex", city: "Salem", pincode: "636006", whatsapp_number: "9321098765", alt_number: "8321098765", active: true },
    { id: makeId(), access_code: "PCPL0008", name: "Suresh Iyer", address_line1: "67, Cotton Mills Road", address_line2: null, city: "Salem", pincode: "636007", whatsapp_number: "9210987654", alt_number: null, active: true },
    { id: makeId(), access_code: "PCPL0009", name: "Anjali Patel", address_line1: "90, College Road", address_line2: "Near Government School", city: "Salem", pincode: "636008", whatsapp_number: "9109876543", alt_number: "8109876543", active: true },
    { id: makeId(), access_code: "PCPL0010", name: "Rajesh Menon", address_line1: "11, Railway Nagar", address_line2: "Plot 42", city: "Salem", pincode: "636009", whatsapp_number: "9098765432", alt_number: null, active: true },
  ];

  const groups: ChitGroup[] = [
    { id: makeId(), group_code: "CHIT-A1", agreement_no: "AG-2026-001", chit_value: 100000, duration_months: 20, auction_day: 5, auction_time: "5:30 PM", commission_rate: 5, start_month: "2026-05", status: "active" },
    { id: makeId(), group_code: "CHIT-B1", agreement_no: "AG-2026-002", chit_value: 250000, duration_months: 24, auction_day: 12, auction_time: "6:00 PM", commission_rate: 6, start_month: "2026-05", status: "active" },
    { id: makeId(), group_code: "CHIT-C1", agreement_no: "AG-2026-003", chit_value: 500000, duration_months: 30, auction_day: 18, auction_time: "7:00 PM", commission_rate: 5, start_month: "2026-05", status: "active" },
  ];

  const groupByCode = new Map(groups.map((group) => [group.group_code, group]));
  const subscriberByCode = new Map(subscribers.map((subscriber) => [subscriber.access_code, subscriber]));

  const subscriptions: Subscription[] = [
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0001")!.id, group_id: groupByCode.get("CHIT-A1")!.id, name_on_chit: "Anitha Raman", seat_count: 1, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0001")!.id, group_id: groupByCode.get("CHIT-B1")!.id, name_on_chit: "Anitha Raman", seat_count: 1, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0002")!.id, group_id: groupByCode.get("CHIT-A1")!.id, name_on_chit: "Ramesh Kumar", seat_count: 1, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0003")!.id, group_id: groupByCode.get("CHIT-B1")!.id, name_on_chit: "Priya Shankar", seat_count: 1, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0004")!.id, group_id: groupByCode.get("CHIT-C1")!.id, name_on_chit: "Vikram Singh", seat_count: 2, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0005")!.id, group_id: groupByCode.get("CHIT-A1")!.id, name_on_chit: "Meera Reddy", seat_count: 1, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0006")!.id, group_id: groupByCode.get("CHIT-B1")!.id, name_on_chit: "Arun Krishnan", seat_count: 1, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0007")!.id, group_id: groupByCode.get("CHIT-C1")!.id, name_on_chit: "Divya Verma", seat_count: 1, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0008")!.id, group_id: groupByCode.get("CHIT-A1")!.id, name_on_chit: "Suresh Iyer", seat_count: 1, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0009")!.id, group_id: groupByCode.get("CHIT-C1")!.id, name_on_chit: "Anjali Patel", seat_count: 1, prized: false, prized_month: null, active: true },
    { id: makeId(), subscriber_id: subscriberByCode.get("PCPL0010")!.id, group_id: groupByCode.get("CHIT-B1")!.id, name_on_chit: "Rajesh Menon", seat_count: 1, prized: false, prized_month: null, active: true },
  ];

  const month = new Date().toISOString().slice(0, 7);
  const monthlyEntries: DemoMonthlyEntry[] = groups.map((group) => ({
    id: makeId(),
    group_id: group.id,
    month,
    winning_bid: Math.round(group.chit_value * 0.78),
    company_commission: Math.round(group.chit_value * (group.commission_rate / 100)),
    prized_subscription_id: null,
    locked: false,
  }));

  // Seed a mix of dispatch states so the reminders/communications page has realistic data
  const dispatches: DemoDispatch[] = [];
  const dispatchStates = ["sent", "sent", "sent", "pending", "failed"];
  let state_i = 0;
  for (const subscriber of subscribers) {
    const status = dispatchStates[state_i++ % dispatchStates.length];
    if (status === "pending") continue; // pending = no dispatch row, just absence
    dispatches.push({
      id: makeId(),
      subscriber_id: subscriber.id,
      type: "reminder",
      month,
      whatsapp_number: subscriber.whatsapp_number,
      status,
      sent_at: status === "sent" ? new Date(Date.now() - Math.random() * 7 * 86400000).toISOString() : null,
    });
  }

  return { subscribers, groups, subscriptions, monthlyEntries, dispatches };
};

const readState = (): DemoState => {
  if (typeof window === "undefined") return seedState();
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (!raw) {
      const state = seedState();
      window.localStorage.setItem(DEMO_KEY, JSON.stringify(state));
      return state;
    }
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed.subscribers || !parsed.groups || !parsed.subscriptions) {
      const state = seedState();
      window.localStorage.setItem(DEMO_KEY, JSON.stringify(state));
      return state;
    }
    // Migrate forward: older states may not have monthlyEntries or dispatches.
    if (!parsed.monthlyEntries?.length || !parsed.dispatches?.length) {
      const fresh = seedState();
      const migrated = {
        ...parsed,
        monthlyEntries: parsed.monthlyEntries?.length ? parsed.monthlyEntries : fresh.monthlyEntries,
        dispatches: parsed.dispatches?.length ? parsed.dispatches : fresh.dispatches,
      };
      window.localStorage.setItem(DEMO_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return parsed;
  } catch {
    const state = seedState();
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(state));
    return state;
  }
};

const writeState = (state: DemoState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEMO_EVENT));
};

export const ensureDemoState = () => readState();

export const getDemoSubscribers = () => readState().subscribers;
export const getDemoGroups = () => readState().groups;
export const getDemoSubscriptions = () => readState().subscriptions;
export const getDemoStatements = (month?: string, subscriberId?: string) => {
  const list = readState().statements ?? [];
  return list.filter((statement) => (!month || statement.month === month) && (!subscriberId || statement.subscriber_id === subscriberId));
};

export const getDemoSubscriberPayload = () =>
  readState().subscribers.map((subscriber) => ({
    ...subscriber,
    subscriptions: readState().subscriptions
      .filter((subscription) => subscription.subscriber_id === subscriber.id)
      .map((subscription) => ({
        id: subscription.id,
        chit_groups: {
          group_code: readState().groups.find((group) => group.id === subscription.group_id)?.group_code ?? "—",
        },
      })),
  }));

export const getDemoSubscriber = (subscriberId: string) => readState().subscribers.find((subscriber) => subscriber.id === subscriberId) ?? null;
export const getDemoGroup = (groupId: string) => readState().groups.find((group) => group.id === groupId) ?? null;

export const getDemoSubscriberDetail = (subscriberId: string) => {
  const state = readState();
  const subscriber = state.subscribers.find((item) => item.id === subscriberId);
  if (!subscriber) return null;
  return {
    ...subscriber,
    subscriptions: state.subscriptions
      .filter((subscription) => subscription.subscriber_id === subscriberId)
      .map((subscription) => ({
        ...subscription,
        chit_groups: state.groups.find((group) => group.id === subscription.group_id) ?? null,
      })),
  };
};

export const getDemoGroupDetail = (groupId: string) => {
  const state = readState();
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return null;
  return {
    ...group,
    members: state.subscriptions
      .filter((subscription) => subscription.group_id === groupId)
      .map((subscription) => ({
        ...subscription,
        subscribers: state.subscribers.find((subscriber) => subscriber.id === subscription.subscriber_id) ?? null,
      })),
  };
};

export const saveDemoSubscriber = (payload: Partial<Subscriber> & Pick<Subscriber, "access_code" | "name" | "whatsapp_number">, existingId?: string) => {
  const state = readState();
  const next: Subscriber = {
    id: existingId ?? makeId(),
    access_code: payload.access_code,
    name: payload.name,
    address_line1: payload.address_line1 ?? null,
    address_line2: payload.address_line2 ?? null,
    city: payload.city ?? "Salem",
    pincode: payload.pincode ?? null,
    whatsapp_number: payload.whatsapp_number,
    alt_number: payload.alt_number ?? null,
    active: payload.active ?? true,
  };
  const subscribers = existingId
    ? state.subscribers.map((subscriber) => (subscriber.id === existingId ? next : subscriber))
    : [...state.subscribers, next];
  writeState({ ...state, subscribers });
  return next;
};

export const deleteDemoSubscriber = (subscriberId: string) => {
  const state = readState();
  const subscribers = state.subscribers.filter((subscriber) => subscriber.id !== subscriberId);
  const subscriptions = state.subscriptions.filter((subscription) => subscription.subscriber_id !== subscriberId);
  writeState({ ...state, subscribers, subscriptions });
};

export const saveDemoGroup = (payload: Partial<ChitGroup> & Pick<ChitGroup, "group_code" | "chit_value" | "duration_months" | "auction_day">, existingId?: string) => {
  const state = readState();
  const next: ChitGroup = {
    id: existingId ?? makeId(),
    group_code: payload.group_code,
    agreement_no: payload.agreement_no ?? null,
    chit_value: Number(payload.chit_value),
    duration_months: Number(payload.duration_months),
    auction_day: Number(payload.auction_day),
    auction_time: payload.auction_time ?? null,
    commission_rate: Number(payload.commission_rate ?? 5),
    start_month: payload.start_month ?? null,
    status: payload.status ?? "active",
  };
  const groups = existingId ? state.groups.map((group) => (group.id === existingId ? next : group)) : [...state.groups, next];
  writeState({ ...state, groups });
  return next;
};

export const deleteDemoGroup = (groupId: string) => {
  const state = readState();
  const groups = state.groups.filter((group) => group.id !== groupId);
  const subscriptions = state.subscriptions.filter((subscription) => subscription.group_id !== groupId);
  writeState({ ...state, groups, subscriptions });
};

export const addDemoSubscription = (payload: { subscriber_id: string; group_id: string; name_on_chit: string; seat_count: number; prized?: boolean; prized_month?: string | null; active?: boolean }) => {
  const state = readState();
  const next: Subscription = {
    id: makeId(),
    subscriber_id: payload.subscriber_id,
    group_id: payload.group_id,
    name_on_chit: payload.name_on_chit,
    seat_count: payload.seat_count,
    prized: payload.prized ?? false,
    prized_month: payload.prized_month ?? null,
    active: payload.active ?? true,
  };
  writeState({ ...state, subscriptions: [...state.subscriptions, next] });
  return next;
};

export const deleteDemoSubscription = (subscriptionId: string) => {
  const state = readState();
  writeState({ ...state, subscriptions: state.subscriptions.filter((subscription) => subscription.id !== subscriptionId) });
};

export const getDemoMonthlyEntries = (month?: string) => {
  const state = readState();
  let entries = state.monthlyEntries ?? [];

  if (month) {
    const groups = state.groups;
    const existingGroupIds = new Set(entries.filter((e) => e.month === month).map((e) => e.group_id));
    const statementGroupIds = new Set((state.statements ?? []).filter((statement) => statement.month === month).map((statement) => statement.group_id));
    const missingGroups = groups.filter((group) => !existingGroupIds.has(group.id));
    const newEntries = missingGroups.map((group) => ({
      id: makeId(),
      group_id: group.id,
      month,
      winning_bid: Math.round(group.chit_value * 0.78),
      company_commission: Math.round(group.chit_value * (group.commission_rate / 100)),
      prized_subscription_id: null,
      locked: false,
    }));
    const statementEntries = groups
      .filter((group) => statementGroupIds.has(group.id) && !existingGroupIds.has(group.id))
      .map((group) => ({
        id: makeId(),
        group_id: group.id,
        month,
        winning_bid: Math.round(group.chit_value * 0.78),
        company_commission: Math.round(group.chit_value * (group.commission_rate / 100)),
        prized_subscription_id: null,
        locked: false,
      }));
    if (newEntries.length > 0 || statementEntries.length > 0) {
      entries = [...entries, ...newEntries, ...statementEntries];
      writeState({ ...state, monthlyEntries: entries });
    }
  }

  return month ? entries.filter((e) => e.month === month) : entries;
};

export const upsertDemoStatement = (statement: Omit<DemoStatement, "id">) => {
  const state = readState();
  const list = state.statements ?? [];
  // Use seat_index for upsert key so multi-seat rows for the same
  // (month, subscriber, group) remain as separate statements.
  const seatIdx = statement.seat_index ?? 1;
  const existingIndex = list.findIndex((item) =>
    item.month === statement.month &&
    item.subscriber_id === statement.subscriber_id &&
    item.group_id === statement.group_id &&
    (item.seat_index ?? 1) === seatIdx,
  );
  const next: DemoStatement = { id: existingIndex >= 0 ? list[existingIndex].id : makeId(), ...statement, source: "import", imported_at: new Date().toISOString() };
  const statements = existingIndex >= 0
    ? list.map((item, index) => (index === existingIndex ? next : item))
    : [...list, next];
  writeState({ ...state, statements });
  return next;
};

export const upsertDemoMonthlyEntry = (entry: Partial<DemoMonthlyEntry> & { group_id: string; month: string; winning_bid: number; company_commission: number }) => {
  const state = readState();
  const list = state.monthlyEntries ?? [];
  const existing = list.find((e) => e.group_id === entry.group_id && e.month === entry.month);
  let next: DemoMonthlyEntry;
  if (existing) {
    next = { ...existing, ...entry };
    writeState({ ...state, monthlyEntries: list.map((e) => (e.id === existing.id ? next : e)) });
  } else {
    next = {
      id: makeId(),
      group_id: entry.group_id,
      month: entry.month,
      winning_bid: entry.winning_bid,
      company_commission: entry.company_commission,
      prized_subscription_id: entry.prized_subscription_id ?? null,
      locked: entry.locked ?? false,
    };
    writeState({ ...state, monthlyEntries: [...list, next] });
  }
  return next;
};

export const getDemoDispatches = (month?: string, type?: string) => {
  const list = readState().dispatches ?? [];
  return list.filter((d) => (!month || d.month === month) && (!type || d.type === type));
};

export const addDemoDispatches = (rows: Omit<DemoDispatch, "id">[]) => {
  const state = readState();
  const list = state.dispatches ?? [];
  const next = [...list, ...rows.map((r) => ({ ...r, id: makeId() }))];
  writeState({ ...state, dispatches: next });
};

export const peekNextAccessCode = (): string => {
  return peekNextCustomerCode();
};

export type ImportRow = {
  subscriberName: string;
  accessCode?: string | null;
  whatsapp?: string | null;
  altPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  pincode?: string | null;
  groupCode?: string | null;
  agreeNo?: string | null;
  auctionDate?: string | null;
  auctionTime?: string | null;
  chitValue?: number | null;
  durationMonths?: number | null;
  auctionDay?: number | null;
  commissionRate?: number | null;
  seats?: number | null;
  nameOnChit?: string | null;
  prized?: boolean | null;
  previousBidAmount?: number | null;
  cc?: number | null;
  shareOfDiscount?: number | null;
  chitAmountAfterIncentive?: number | null;
  month?: string | null;
  seatIndex?: number | null;
};

export type ImportSummary = {
  subscribersCreated: number;
  subscribersUpdated: number;
  groupsCreated: number;
  enrollmentsCreated: number;
  enrollmentsSkipped: number;
};

const nextAccessCode = (state: DemoState) => {
  const numbers = state.subscribers
    .map((s) => parseInt((s.access_code.match(/(\d+)$/) || ["", "0"])[1], 10))
    .filter((n) => !Number.isNaN(n));
  const max = numbers.length ? Math.max(...numbers) : 0;
  return `PCPL${String(max + 1).padStart(4, "0")}`;
};

export const importDemoRows = (rows: ImportRow[]): ImportSummary => {
  const state = readState();
  const summary: ImportSummary = {
    subscribersCreated: 0,
    subscribersUpdated: 0,
    groupsCreated: 0,
    enrollmentsCreated: 0,
    enrollmentsSkipped: 0,
  };

  const subscribersByCode = new Map(state.subscribers.map((s) => [s.access_code.toLowerCase(), s]));
  const subscribersByPhone = new Map(state.subscribers.filter((s) => s.whatsapp_number).map((s) => [s.whatsapp_number, s]));
  const subscribersByName = new Map(state.subscribers.map((s) => [s.name.trim().toLowerCase(), s]));
  const existingCustomerCodes = new Set<string>();
  for (const s of state.subscribers) {
    if (s.access_code && /^[A-Z]-\d{4}$/.test(s.access_code)) existingCustomerCodes.add(s.access_code);
  }
  let codeCounter = state.customerCodeCounter ?? 1;
  const allocateCode = (): string => {
    const { code, nextCounter } = generateCustomerCode(existingCustomerCodes, codeCounter);
    codeCounter = nextCounter;
    existingCustomerCodes.add(code);
    return code;
  };
  const groupsByCode = new Map(state.groups.map((g) => [g.group_code.toLowerCase(), g]));
  const enrollmentKey = (sId: string, gId: string) => `${sId}::${gId}`;
  // Each subscription represents one seat; we don't pre-block multi-seat enrollments here.
  const existingEnrollments = new Set<string>();

  for (const row of rows) {
    if (!row.subscriberName?.trim()) continue;

    let subscriber: Subscriber | undefined;
    if (row.accessCode) subscriber = subscribersByCode.get(row.accessCode.toLowerCase());
    if (!subscriber && row.whatsapp) subscriber = subscribersByPhone.get(row.whatsapp.replace(/\D/g, "").slice(-10));
    if (!subscriber) subscriber = subscribersByName.get(row.subscriberName.trim().toLowerCase());

    if (!subscriber) {
      subscriber = {
        id: makeId(),
        access_code: row.accessCode?.trim() || allocateCode(),
        name: row.subscriberName.trim(),
        address_line1: row.addressLine1 ?? null,
        address_line2: row.addressLine2 ?? null,
        city: row.city || "Salem",
        pincode: row.pincode ?? null,
        whatsapp_number: (row.whatsapp || "").replace(/\D/g, "").slice(-10),
        alt_number: row.altPhone ?? null,
        active: true,
      };
      state.subscribers.push(subscriber);
      subscribersByCode.set(subscriber.access_code.toLowerCase(), subscriber);
      if (subscriber.whatsapp_number) subscribersByPhone.set(subscriber.whatsapp_number, subscriber);
      subscribersByName.set(subscriber.name.toLowerCase(), subscriber);
      summary.subscribersCreated++;
    } else {
      let changed = false;
      if (row.whatsapp && !subscriber.whatsapp_number) {
        subscriber.whatsapp_number = row.whatsapp.replace(/\D/g, "").slice(-10);
        changed = true;
      }
      if (row.addressLine1 && !subscriber.address_line1) { subscriber.address_line1 = row.addressLine1; changed = true; }
      if (row.city && subscriber.city === "Salem" && row.city !== "Salem") { subscriber.city = row.city; changed = true; }
      if (row.pincode && !subscriber.pincode) { subscriber.pincode = row.pincode; changed = true; }
      if (changed) summary.subscribersUpdated++;
    }

    if (row.groupCode?.trim()) {
      let group = groupsByCode.get(row.groupCode.trim().toLowerCase());
      if (!group) {
        group = {
          id: makeId(),
          group_code: row.groupCode.trim(),
          agreement_no: null,
          chit_value: Number(row.chitValue) || 100000,
          duration_months: Number(row.durationMonths) || 20,
          auction_day: Number(row.auctionDay) || 5,
          auction_time: "5:00 PM",
          commission_rate: Number(row.commissionRate) || 5,
          start_month: null,
          status: "active",
        };
        state.groups.push(group);
        groupsByCode.set(group.group_code.toLowerCase(), group);
        summary.groupsCreated++;
      } else {
        // Refresh group properties from the latest import so re-imports propagate
        // chit_value / duration / auction_day / commission updates.
        if (Number(row.chitValue)) group.chit_value = Number(row.chitValue);
        if (Number(row.durationMonths)) group.duration_months = Number(row.durationMonths);
        if (Number(row.auctionDay)) group.auction_day = Number(row.auctionDay);
        if (Number(row.commissionRate)) group.commission_rate = Number(row.commissionRate);
      }

      // Each XLSX row = one seat. The parser attaches a seatIndex so the same
      // (subscriber, group) appearing twice yields two distinct enrollments.
      const seatIdx = row.seatIndex ?? 1;
      const key = `${enrollmentKey(subscriber.id, group.id)}::seat${seatIdx}`;
      if (existingEnrollments.has(key)) {
        summary.enrollmentsSkipped++;
      } else {
        state.subscriptions.push({
          id: makeId(),
          subscriber_id: subscriber.id,
          group_id: group.id,
          name_on_chit: row.nameOnChit?.trim() || subscriber.name,
          seat_count: 1,
          prized: row.prized === true,
          prized_month: null,
          active: true,
        });
        existingEnrollments.add(key);
        summary.enrollmentsCreated++;
      }

      if (row.month) {
        const statement: DemoStatement = {
          id: makeId(),
          month: row.month,
          source: "import" as const,
          imported_at: new Date().toISOString(),
          subscriber_id: subscriber.id,
          group_id: group.id,
          group_code: group.group_code,
          access_code: subscriber.access_code,
          subscriber_name: subscriber.name,
          whatsapp_number: subscriber.whatsapp_number,
          address_line1: subscriber.address_line1,
          address_line2: subscriber.address_line2,
          city: subscriber.city,
          pincode: subscriber.pincode,
          auction_date: row.auctionDate ?? null,
          auction_time: row.auctionTime ?? group.auction_time,
          agree_no: row.agreeNo ?? null,
          name_on_chit: row.nameOnChit?.trim() || subscriber.name,
          prized: row.prized === true,
          chit_value: Number(row.chitValue) || group.chit_value,
          previous_bid_amount: row.previousBidAmount ?? null,
          cc: row.cc ?? null,
          share_of_discount: row.shareOfDiscount ?? null,
          period_months: Number(row.durationMonths) || group.duration_months,
          auction_day: Number(row.auctionDay) || group.auction_day,
          chit_amount_after_incentive: row.chitAmountAfterIncentive ?? null,
          seat_index: row.seatIndex ?? 1,
        };
        // Mutate the local state directly instead of calling upsertDemoStatement
        // (which would readState/writeState independently and get clobbered by
        // the final writeState(state) below).
        state.statements = state.statements ?? [];
        const seatIdx = statement.seat_index ?? 1;
        const idx = state.statements.findIndex((item) =>
          item.month === statement.month &&
          item.subscriber_id === statement.subscriber_id &&
          item.group_id === statement.group_id &&
          (item.seat_index ?? 1) === seatIdx,
        );
        if (idx >= 0) state.statements[idx] = { ...statement, id: state.statements[idx].id };
        else state.statements.push(statement);
      }
    }
  }

  state.customerCodeCounter = codeCounter;
  writeState(state);
  return summary;
};

export const clearAllDemoData = () => {
  if (typeof window === "undefined") return;
  const emptyState: DemoState = {
    subscribers: [],
    groups: [],
    subscriptions: [],
    monthlyEntries: [],
    dispatches: [],
    statements: [],
  };
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(emptyState));
  window.dispatchEvent(new CustomEvent(DEMO_EVENT));
};

export const clearImportedData = () => {
  const state = readState();
  
  // Get all imported group IDs
  const importedGroupIds = new Set(
    (state.statements ?? [])
      .filter((s) => s.source === "import")
      .map((s) => s.group_id)
  );

  // Remove subscriptions and groups that only exist in imports
  const remainingSubscriptions = state.subscriptions.filter((sub) => {
    // Keep subscriptions that reference non-imported groups
    const group = state.groups.find((g) => g.id === sub.group_id);
    if (!group) return false; // Group doesn't exist, remove subscription
    
    // Check if this group only has imported statements
    const groupStatements = (state.statements ?? []).filter((s) => s.group_id === group.id);
    const allImported = groupStatements.every((s) => s.source === "import");
    
    // If group has no statements or only imported ones, remove the subscription
    if (allImported && groupStatements.length > 0) return false;
    return true;
  });

  // Keep only groups that have remaining subscriptions
  const remainingGroupIds = new Set(remainingSubscriptions.map((s) => s.group_id));
  const remainingGroups = state.groups.filter((g) => remainingGroupIds.has(g.id));

  // Keep only subscribers that have remaining subscriptions
  const remainingSubIds = new Set(remainingSubscriptions.map((s) => s.subscriber_id));
  const remainingSubscribers = state.subscribers.filter((s) => remainingSubIds.has(s.id));

  // Remove all imported statements
  const seedStatements = (state.statements ?? []).filter((s) => s.source === "seed");

  writeState({
    ...state,
    subscribers: remainingSubscribers,
    groups: remainingGroups,
    subscriptions: remainingSubscriptions,
    statements: seedStatements,
  });
};

// ---- UPI Settings ----

const DEFAULT_UPI: UpiSettings = { mode: "none", upiId: null, payeeName: null, staticImage: null };

export const getUpiSettings = (): UpiSettings => {
  return readState().upi ?? DEFAULT_UPI;
};

export const saveUpiSettings = (next: Partial<UpiSettings>) => {
  const state = readState();
  const current = state.upi ?? DEFAULT_UPI;
  const merged: UpiSettings = { ...current, ...next };
  // Mutual exclusion: if mode flips, clear the other side's data
  if (merged.mode === "static") {
    merged.upiId = null;
    merged.payeeName = null;
  } else if (merged.mode === "dynamic") {
    merged.staticImage = null;
  } else {
    merged.staticImage = null;
    merged.upiId = null;
    merged.payeeName = null;
  }
  writeState({ ...state, upi: merged });
  return merged;
};

// ---- Customer Code Generator (A-0001..Z-9999) ----

export const generateCustomerCode = (existingCodes: Set<string>, counter: number): { code: string; nextCounter: number } => {
  // counter is sequential 1..(26*9999)
  let next = counter;
  while (next <= 26 * 9999) {
    const letterIdx = Math.floor((next - 1) / 9999);
    const num = ((next - 1) % 9999) + 1;
    const code = `${String.fromCharCode(65 + letterIdx)}-${String(num).padStart(4, "0")}`;
    if (!existingCodes.has(code)) return { code, nextCounter: next + 1 };
    next++;
  }
  throw new Error("Customer code space exhausted");
};

export const peekNextCustomerCode = (): string => {
  const state = readState();
  const existing = new Set<string>();
  for (const sub of state.subscribers) {
    if (sub.access_code && /^[A-Z]-\d{4}$/.test(sub.access_code)) existing.add(sub.access_code);
  }
  const counter = state.customerCodeCounter ?? 1;
  return generateCustomerCode(existing, counter).code;
};

// ---- Import History ----

export const getImportHistory = (): ImportHistoryEntry[] => {
  return readState().importHistory ?? [];
};

export const addImportHistory = (entry: Omit<ImportHistoryEntry, "id" | "importedAt">) => {
  const state = readState();
  const list = state.importHistory ?? [];
  const next: ImportHistoryEntry = { id: makeId(), importedAt: new Date().toISOString(), ...entry };
  writeState({ ...state, importHistory: [next, ...list].slice(0, 50) });
  return next;
};

export const isRlsError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error ?? "");
  return message.includes("row-level security") || message.includes("42501");
};
