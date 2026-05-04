import { supabase } from "@/integrations/supabase/client";
import { currentMonth } from "@/lib/format";

const KEY_LINKS = "chitflow_subscriber_links_v1";
const KEY_REMINDERS = "chitflow_reminders_v1";
const KEY_LAST_TICK = "chitflow_last_scheduler_tick";
const KEY_ACTION_LOG = "chitflow_ai_action_log_v1";

export type SubscriberLink = {
  child_id: string;
  parent_id: string;
  relation: string;
  created_at: string;
};

export type Reminder = {
  id: string;
  name: string;
  target_subscriber_id: string;
  include_subscriber_ids: string[];
  cadence: "monthly";
  day_of_month: number;
  channel: "whatsapp";
  message_template: string;
  next_run: string;
  last_run: string | null;
  active: boolean;
  created_at: string;
};

export type ActionLogEntry = {
  id: string;
  at: string;
  kind: string;
  summary: string;
};

const load = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export const getLinks = (): SubscriberLink[] => load(KEY_LINKS, []);
export const setLinks = (l: SubscriberLink[]) => save(KEY_LINKS, l);
export function linkSubscribers(child_id: string, parent_id: string, relation = "child_of") {
  const links = getLinks().filter((l) => !(l.child_id === child_id && l.parent_id === parent_id));
  links.push({ child_id, parent_id, relation, created_at: new Date().toISOString() });
  setLinks(links);
}
export function unlinkSubscribers(child_id: string, parent_id: string) {
  setLinks(getLinks().filter((l) => !(l.child_id === child_id && l.parent_id === parent_id)));
}
export function childrenOf(parent_id: string): string[] {
  return getLinks().filter((l) => l.parent_id === parent_id).map((l) => l.child_id);
}
export function parentsOf(child_id: string): string[] {
  return getLinks().filter((l) => l.child_id === child_id).map((l) => l.parent_id);
}

export const getReminders = (): Reminder[] => load(KEY_REMINDERS, []);
export const setReminders = (r: Reminder[]) => save(KEY_REMINDERS, r);

export function nextMonthlyRun(day_of_month: number, from = new Date()): string {
  const d = new Date(from);
  d.setHours(9, 0, 0, 0);
  const tryThisMonth = new Date(d.getFullYear(), d.getMonth(), Math.min(day_of_month, 28), 9, 0, 0);
  if (tryThisMonth > from) return tryThisMonth.toISOString();
  return new Date(d.getFullYear(), d.getMonth() + 1, Math.min(day_of_month, 28), 9, 0, 0).toISOString();
}

export function scheduleReminder(input: {
  name: string;
  target_subscriber_id: string;
  include_subscriber_ids?: string[];
  day_of_month: number;
  message_template?: string;
}): Reminder {
  const r: Reminder = {
    id: crypto.randomUUID(),
    name: input.name,
    target_subscriber_id: input.target_subscriber_id,
    include_subscriber_ids: input.include_subscriber_ids ?? [],
    cadence: "monthly",
    day_of_month: input.day_of_month,
    channel: "whatsapp",
    message_template:
      input.message_template ??
      "Dear {name}, your monthly chit dues are ready. Total: {total_due}. Linked dues: {linked_summary}.",
    next_run: nextMonthlyRun(input.day_of_month),
    last_run: null,
    active: true,
    created_at: new Date().toISOString(),
  };
  const all = getReminders();
  all.push(r);
  setReminders(all);
  return r;
}

export function deleteReminder(id: string): boolean {
  const before = getReminders();
  const after = before.filter((r) => r.id !== id);
  setReminders(after);
  return after.length < before.length;
}

export function getActionLog(): ActionLogEntry[] {
  return load<ActionLogEntry[]>(KEY_ACTION_LOG, []);
}
export function logAction(kind: string, summary: string) {
  const log = getActionLog();
  log.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), kind, summary });
  save(KEY_ACTION_LOG, log.slice(0, 50));
}

async function fireReminder(r: Reminder, month: string) {
  const ids = [r.target_subscriber_id, ...r.include_subscriber_ids];
  const { data: subs } = await supabase.from("subscribers").select("id,name,whatsapp_number").in("id", ids);
  const subById = new Map((subs ?? []).map((s) => [s.id, s]));
  const target = subById.get(r.target_subscriber_id);
  if (!target) return;

  const { data: dueRows } = await supabase
    .from("member_dues")
    .select("subscription_id, chit_amount_due, subscriptions!inner(subscriber_id, group_id, chit_groups(group_code, chit_value))")
    .in("subscriptions.subscriber_id", ids);

  const totalsBySub: Record<string, number> = {};
  (dueRows ?? []).forEach((row: any) => {
    const sid = row.subscriptions?.subscriber_id;
    if (!sid) return;
    totalsBySub[sid] = (totalsBySub[sid] ?? 0) + Number(row.chit_amount_due ?? 0);
  });

  const total = totalsBySub[target.id] ?? 0;
  const linkedSummary = r.include_subscriber_ids
    .map((id) => {
      const s = subById.get(id);
      if (!s) return null;
      return `${s.name}: ${(totalsBySub[id] ?? 0).toLocaleString("en-IN")}`;
    })
    .filter(Boolean)
    .join(", ") || "none";

  await supabase.from("dispatch_log").upsert(
    {
      subscriber_id: target.id,
      month,
      whatsapp_number: target.whatsapp_number,
      status: "sent",
      sent_at: new Date().toISOString(),
      attempt_count: 1,
      last_error: null,
    },
    { onConflict: "subscriber_id,month" },
  );

  logAction(
    "reminder_fired",
    `Sent reminder "${r.name}" to ${target.name} (₹${total.toLocaleString("en-IN")}); linked: ${linkedSummary}`,
  );
}

export async function runDueReminders(force = false): Promise<{ fired: number; checked: number }> {
  const all = getReminders().filter((r) => r.active);
  const now = new Date();
  const month = currentMonth();
  let fired = 0;
  for (const r of all) {
    if (!force && new Date(r.next_run) > now) continue;
    try {
      await fireReminder(r, month);
      r.last_run = now.toISOString();
      r.next_run = nextMonthlyRun(r.day_of_month, new Date(now.getTime() + 60_000));
      fired++;
    } catch (e) {
      logAction("reminder_failed", `${r.name}: ${(e as Error).message}`);
    }
  }
  setReminders(getReminders().map((rem) => all.find((u) => u.id === rem.id) ?? rem));
  localStorage.setItem(KEY_LAST_TICK, now.toISOString());
  return { fired, checked: all.length };
}

export function getLastTick(): string | null {
  return localStorage.getItem(KEY_LAST_TICK);
}
