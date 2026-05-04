import { supabase } from "@/integrations/supabase/client";
import {
  childrenOf,
  deleteReminder,
  getActionLog,
  getLinks,
  getReminders,
  linkSubscribers,
  logAction,
  parentsOf,
  runDueReminders,
  scheduleReminder,
  unlinkSubscribers,
} from "@/lib/ai-scheduler";

export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const TOOLS: ToolDef[] = [
  {
    name: "list_subscribers",
    description: "Search/list subscribers by name, access_code, or phone (whatsapp_number). Empty query = first N.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text query (name fragment, access code, or phone)" },
        limit: { type: "number", default: 20 },
        only_active: { type: "boolean", default: true },
      },
    },
  },
  {
    name: "get_subscriber",
    description: "Fetch one subscriber by id or access_code, including their subscriptions, group info, and current-month dues.",
    parameters: {
      type: "object",
      properties: { id_or_code: { type: "string" } },
      required: ["id_or_code"],
    },
  },
  {
    name: "create_subscriber",
    description: "Create a new subscriber. access_code must be unique.",
    parameters: {
      type: "object",
      properties: {
        access_code: { type: "string" },
        name: { type: "string" },
        whatsapp_number: { type: "string" },
        alt_number: { type: "string" },
        address_line1: { type: "string" },
        address_line2: { type: "string" },
        city: { type: "string", default: "Salem" },
        pincode: { type: "string" },
      },
      required: ["access_code", "name", "whatsapp_number"],
    },
  },
  {
    name: "update_subscriber",
    description: "Update mutable fields of a subscriber. Pass id and any subset of fields.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        patch: {
          type: "object",
          description: "Any of: name, whatsapp_number, alt_number, address_line1, address_line2, city, pincode, active",
        },
      },
      required: ["id", "patch"],
    },
  },
  {
    name: "delete_subscriber",
    description: "Soft-delete a subscriber by setting active=false. Pass hard:true to actually delete the row (cascades subscriptions).",
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, hard: { type: "boolean", default: false } },
      required: ["id"],
    },
  },
  {
    name: "list_groups",
    description: "List chit groups, optionally filter by status (active/completed) or query by group_code/agreement_no.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, status: { type: "string" }, limit: { type: "number", default: 20 } },
    },
  },
  {
    name: "get_group",
    description: "Fetch one group with its current-month entry and member_dues. Pass id or group_code.",
    parameters: { type: "object", properties: { id_or_code: { type: "string" } }, required: ["id_or_code"] },
  },
  {
    name: "create_group",
    description: "Create a chit group.",
    parameters: {
      type: "object",
      properties: {
        group_code: { type: "string" },
        chit_value: { type: "number" },
        duration_months: { type: "number" },
        auction_day: { type: "number" },
        auction_time: { type: "string" },
        commission_rate: { type: "number", default: 5 },
        start_month: { type: "string", description: "YYYY-MM" },
        agreement_no: { type: "string" },
      },
      required: ["group_code", "chit_value", "duration_months", "auction_day"],
    },
  },
  {
    name: "update_group",
    description: "Update fields of a group.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, patch: { type: "object" } },
      required: ["id", "patch"],
    },
  },
  {
    name: "delete_group",
    description: "Delete a chit group (cascades subscriptions and dues).",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "list_subscriptions",
    description: "List subscriptions for a subscriber, a group, or both.",
    parameters: {
      type: "object",
      properties: { subscriber_id: { type: "string" }, group_id: { type: "string" }, only_active: { type: "boolean", default: true } },
    },
  },
  {
    name: "create_subscription",
    description: "Enroll a subscriber into a group.",
    parameters: {
      type: "object",
      properties: {
        subscriber_id: { type: "string" },
        group_id: { type: "string" },
        name_on_chit: { type: "string" },
        seat_count: { type: "number", default: 1 },
      },
      required: ["subscriber_id", "group_id", "name_on_chit"],
    },
  },
  {
    name: "delete_subscription",
    description: "Remove a subscription (cascades dues).",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "get_dues",
    description: "Fetch member_dues for a subscriber and/or month. Returns chit_amount_due breakdown per subscription.",
    parameters: {
      type: "object",
      properties: { subscriber_id: { type: "string" }, month: { type: "string", description: "YYYY-MM" } },
    },
  },
  {
    name: "list_dispatch_log",
    description: "List dispatch entries for a month and/or status.",
    parameters: {
      type: "object",
      properties: { month: { type: "string" }, status: { type: "string" }, limit: { type: "number", default: 50 } },
    },
  },
  {
    name: "send_dispatch_now",
    description: "Mark a subscriber's dispatch for a given month as sent (mock send for demo). Creates the row if missing.",
    parameters: {
      type: "object",
      properties: { subscriber_id: { type: "string" }, month: { type: "string" } },
      required: ["subscriber_id", "month"],
    },
  },
  {
    name: "link_subscribers",
    description: "Link two subscribers in a family relationship (e.g. son's records get attached to father's reminders). Both ids required.",
    parameters: {
      type: "object",
      properties: {
        child_id: { type: "string" },
        parent_id: { type: "string" },
        relation: { type: "string", default: "child_of" },
      },
      required: ["child_id", "parent_id"],
    },
  },
  {
    name: "unlink_subscribers",
    description: "Remove a parent/child link.",
    parameters: {
      type: "object",
      properties: { child_id: { type: "string" }, parent_id: { type: "string" } },
      required: ["child_id", "parent_id"],
    },
  },
  {
    name: "list_links",
    description: "List all family links currently stored.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "schedule_recurring_reminder",
    description:
      "Create a monthly recurring reminder for a target subscriber with optional linked subscribers (e.g. include the son's dues in the father's monthly statement). Day_of_month controls when to fire each month.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        target_subscriber_id: { type: "string" },
        include_subscriber_ids: { type: "array", items: { type: "string" } },
        day_of_month: { type: "number", default: 1 },
        message_template: { type: "string" },
      },
      required: ["name", "target_subscriber_id"],
    },
  },
  {
    name: "list_reminders",
    description: "List all scheduled reminders.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "delete_reminder",
    description: "Delete a scheduled reminder by id.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "run_due_reminders",
    description: "Force-run any reminders whose next_run is in the past (or all of them if force=true). Returns counts.",
    parameters: { type: "object", properties: { force: { type: "boolean", default: false } } },
  },
  {
    name: "get_action_log",
    description: "Recent AI/scheduler actions taken in this browser.",
    parameters: { type: "object", properties: { limit: { type: "number", default: 20 } } },
  },
];

const ok = (data: unknown) => ({ ok: true, data });
const fail = (error: string) => ({ ok: false, error });

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function runTool(name: string, args: Record<string, any>): Promise<unknown> {
  try {
    switch (name) {
      case "list_subscribers": {
        const limit = args.limit ?? 20;
        let q = supabase.from("subscribers").select("id,access_code,name,whatsapp_number,alt_number,city,active");
        if (args.only_active !== false) q = q.eq("active", true);
        if (args.query) {
          const term = String(args.query).trim();
          q = q.or(`name.ilike.%${term}%,access_code.ilike.%${term}%,whatsapp_number.ilike.%${term}%`);
        }
        const { data, error } = await q.limit(limit);
        if (error) return fail(error.message);
        return ok(data);
      }
      case "get_subscriber": {
        const v = args.id_or_code as string;
        const col = isUUID(v) ? "id" : "access_code";
        const { data: sub, error } = await supabase.from("subscribers").select("*").eq(col, v).maybeSingle();
        if (error) return fail(error.message);
        if (!sub) return fail("subscriber not found");
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("id,name_on_chit,seat_count,prized,active,group_id,chit_groups(group_code,chit_value,duration_months,status)")
          .eq("subscriber_id", sub.id);
        return ok({ ...sub, subscriptions: subs ?? [], links: { children: childrenOf(sub.id), parents: parentsOf(sub.id) } });
      }
      case "create_subscriber": {
        const { data, error } = await supabase
          .from("subscribers")
          .insert({
            access_code: args.access_code,
            name: args.name,
            whatsapp_number: args.whatsapp_number,
            alt_number: args.alt_number ?? null,
            address_line1: args.address_line1 ?? null,
            address_line2: args.address_line2 ?? null,
            city: args.city ?? "Salem",
            pincode: args.pincode ?? null,
          })
          .select()
          .single();
        if (error) return fail(error.message);
        logAction("create_subscriber", `Created ${data.name} (${data.access_code})`);
        return ok(data);
      }
      case "update_subscriber": {
        const { data, error } = await supabase.from("subscribers").update(args.patch).eq("id", args.id).select().single();
        if (error) return fail(error.message);
        logAction("update_subscriber", `Updated ${data.name}`);
        return ok(data);
      }
      case "delete_subscriber": {
        if (args.hard) {
          const { error } = await supabase.from("subscribers").delete().eq("id", args.id);
          if (error) return fail(error.message);
          logAction("delete_subscriber", `Hard-deleted ${args.id}`);
          return ok({ deleted: true });
        }
        const { error } = await supabase.from("subscribers").update({ active: false }).eq("id", args.id);
        if (error) return fail(error.message);
        logAction("delete_subscriber", `Deactivated ${args.id}`);
        return ok({ deactivated: true });
      }
      case "list_groups": {
        let q = supabase.from("chit_groups").select("*");
        if (args.status) q = q.eq("status", args.status);
        if (args.query) {
          const t = String(args.query).trim();
          q = q.or(`group_code.ilike.%${t}%,agreement_no.ilike.%${t}%`);
        }
        const { data, error } = await q.limit(args.limit ?? 20);
        if (error) return fail(error.message);
        return ok(data);
      }
      case "get_group": {
        const v = args.id_or_code as string;
        const col = isUUID(v) ? "id" : "group_code";
        const { data: g, error } = await supabase.from("chit_groups").select("*").eq(col, v).maybeSingle();
        if (error) return fail(error.message);
        if (!g) return fail("group not found");
        const { data: entries } = await supabase
          .from("monthly_entries")
          .select("*")
          .eq("group_id", g.id)
          .order("month", { ascending: false })
          .limit(6);
        return ok({ ...g, recent_entries: entries ?? [] });
      }
      case "create_group": {
        const { data, error } = await supabase
          .from("chit_groups")
          .insert({
            group_code: args.group_code,
            chit_value: args.chit_value,
            duration_months: args.duration_months,
            auction_day: args.auction_day,
            auction_time: args.auction_time ?? null,
            commission_rate: args.commission_rate ?? 5,
            start_month: args.start_month ?? null,
            agreement_no: args.agreement_no ?? null,
          })
          .select()
          .single();
        if (error) return fail(error.message);
        logAction("create_group", `Created group ${data.group_code}`);
        return ok(data);
      }
      case "update_group": {
        const { data, error } = await supabase.from("chit_groups").update(args.patch).eq("id", args.id).select().single();
        if (error) return fail(error.message);
        logAction("update_group", `Updated group ${data.group_code}`);
        return ok(data);
      }
      case "delete_group": {
        const { error } = await supabase.from("chit_groups").delete().eq("id", args.id);
        if (error) return fail(error.message);
        logAction("delete_group", `Deleted group ${args.id}`);
        return ok({ deleted: true });
      }
      case "list_subscriptions": {
        let q = supabase
          .from("subscriptions")
          .select("id,subscriber_id,group_id,name_on_chit,seat_count,prized,active,subscribers(name,access_code),chit_groups(group_code,chit_value)");
        if (args.subscriber_id) q = q.eq("subscriber_id", args.subscriber_id);
        if (args.group_id) q = q.eq("group_id", args.group_id);
        if (args.only_active !== false) q = q.eq("active", true);
        const { data, error } = await q.limit(100);
        if (error) return fail(error.message);
        return ok(data);
      }
      case "create_subscription": {
        const { data, error } = await supabase
          .from("subscriptions")
          .insert({
            subscriber_id: args.subscriber_id,
            group_id: args.group_id,
            name_on_chit: args.name_on_chit,
            seat_count: args.seat_count ?? 1,
          })
          .select()
          .single();
        if (error) return fail(error.message);
        logAction("create_subscription", `Enrolled subscriber into group`);
        return ok(data);
      }
      case "delete_subscription": {
        const { error } = await supabase.from("subscriptions").delete().eq("id", args.id);
        if (error) return fail(error.message);
        logAction("delete_subscription", `Removed subscription ${args.id}`);
        return ok({ deleted: true });
      }
      case "get_dues": {
        let q = supabase
          .from("member_dues")
          .select(
            "id,base_installment,share_of_discount,chit_amount_due,subscription_id,monthly_entry_id,subscriptions!inner(subscriber_id,group_id,chit_groups(group_code)),monthly_entries!inner(month)",
          );
        if (args.subscriber_id) q = q.eq("subscriptions.subscriber_id", args.subscriber_id);
        if (args.month) q = q.eq("monthly_entries.month", args.month);
        const { data, error } = await q.limit(200);
        if (error) return fail(error.message);
        const total = (data ?? []).reduce((a: number, r: any) => a + Number(r.chit_amount_due ?? 0), 0);
        return ok({ rows: data, total });
      }
      case "list_dispatch_log": {
        let q = supabase
          .from("dispatch_log")
          .select("id,subscriber_id,month,status,whatsapp_number,sent_at,attempt_count,subscribers(name,access_code)");
        if (args.month) q = q.eq("month", args.month);
        if (args.status) q = q.eq("status", args.status);
        const { data, error } = await q.order("sent_at", { ascending: false }).limit(args.limit ?? 50);
        if (error) return fail(error.message);
        return ok(data);
      }
      case "send_dispatch_now": {
        const { data: sub, error: e1 } = await supabase
          .from("subscribers")
          .select("id,name,whatsapp_number")
          .eq("id", args.subscriber_id)
          .maybeSingle();
        if (e1 || !sub) return fail(e1?.message || "subscriber not found");
        const { data, error } = await supabase
          .from("dispatch_log")
          .upsert(
            {
              subscriber_id: sub.id,
              month: args.month,
              whatsapp_number: sub.whatsapp_number,
              status: "sent",
              sent_at: new Date().toISOString(),
              attempt_count: 1,
              last_error: null,
            },
            { onConflict: "subscriber_id,month" },
          )
          .select()
          .single();
        if (error) return fail(error.message);
        logAction("send_dispatch", `Sent dispatch to ${sub.name} for ${args.month}`);
        return ok(data);
      }
      case "link_subscribers": {
        linkSubscribers(args.child_id, args.parent_id, args.relation ?? "child_of");
        logAction("link_subscribers", `Linked ${args.child_id} -> ${args.parent_id}`);
        return ok({ linked: true });
      }
      case "unlink_subscribers": {
        unlinkSubscribers(args.child_id, args.parent_id);
        return ok({ unlinked: true });
      }
      case "list_links":
        return ok(getLinks());
      case "schedule_recurring_reminder": {
        const r = scheduleReminder({
          name: args.name,
          target_subscriber_id: args.target_subscriber_id,
          include_subscriber_ids: args.include_subscriber_ids ?? [],
          day_of_month: args.day_of_month ?? 1,
          message_template: args.message_template,
        });
        logAction("schedule_reminder", `Scheduled "${r.name}" for day ${r.day_of_month}, next: ${r.next_run.slice(0, 10)}`);
        return ok(r);
      }
      case "list_reminders":
        return ok(getReminders());
      case "delete_reminder": {
        const removed = deleteReminder(args.id);
        return ok({ removed });
      }
      case "run_due_reminders":
        return ok(await runDueReminders(!!args.force));
      case "get_action_log":
        return ok(getActionLog().slice(0, args.limit ?? 20));
      default:
        return fail(`unknown tool: ${name}`);
    }
  } catch (e) {
    return fail((e as Error).message);
  }
}
