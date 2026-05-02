import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-types";
import {
  Users, Layers3, Send, AlertTriangle,
  ClipboardList, Bell, Receipt as ReceiptIcon,
  ArrowUpRight, CheckCircle2, Clock, XCircle, ChevronRight,
} from "lucide-react";
import { currentMonth, formatMonth, formatINR, formatDateDMY } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: () => (
    <ProtectedLayout>
      <Dashboard />
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Dashboard — Panasuna Chits" }] }),
});

function Dashboard() {
  const month = currentMonth();
  const today = new Date().getDate();
  const monthLabel = formatMonth(month);

  const stats = useQuery({
    queryKey: ["dashboard-v2", month, today],
    queryFn: async () => {
      const [subs, groups, sentMonth, totalDispatch, todayGroupsRes, allActiveGroups, monthEntries, recentDispatch, failed] =
        await Promise.all([
          db.from("subscribers").select("id", { count: "exact", head: true }).eq("active", true),
          db.from("chit_groups").select("id", { count: "exact", head: true }).eq("status", "active"),
          db.from("dispatch_log").select("id", { count: "exact", head: true }).eq("month", month).in("status", ["sent", "delivered", "read"]),
          db.from("dispatch_log").select("id", { count: "exact", head: true }).eq("month", month),
          db.from("chit_groups").select("id, group_code, auction_day, chit_value, auction_time").eq("auction_day", today).eq("status", "active"),
          db.from("chit_groups").select("id, group_code, auction_day, chit_value").eq("status", "active"),
          db.from("monthly_entries").select("group_id").eq("month", month),
          db.from("dispatch_log").select("id, subscriber_id, status, sent_at, whatsapp_number, type, subscribers!inner(name, access_code)").eq("month", month).order("created_at", { ascending: false }).limit(10),
          db.from("dispatch_log").select("id, subscriber_id, status, last_error, whatsapp_number, subscribers!inner(name, access_code)").eq("status", "failed").order("created_at", { ascending: false }).limit(5),
        ]);

      const enteredIds = new Set((monthEntries.data ?? []).map((e: any) => e.group_id));
      const pendingEntry = (allActiveGroups.data ?? []).filter((g: any) => !enteredIds.has(g.id));
      const upcomingAuctions = (allActiveGroups.data ?? [])
        .filter((g: any) => g.auction_day >= today && g.auction_day <= today + 7)
        .sort((a: any, b: any) => a.auction_day - b.auction_day);

      return {
        subscribers: subs.count ?? 0,
        groups: groups.count ?? 0,
        sentThisMonth: sentMonth.count ?? 0,
        totalDispatch: totalDispatch.count ?? 0,
        todayGroups: todayGroupsRes.data ?? [],
        pendingEntry,
        upcomingAuctions,
        recentDispatch: recentDispatch.data ?? [],
        failed: failed.data ?? [],
      };
    },
  });

  const data = stats.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display text-foreground">Good day at Panasuna</h1>
          <p className="text-sm text-text-2 mt-1">
            {monthLabel} · Today is {today}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/data-entry"
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition lift hover:bg-navy-2"
          >
            <ClipboardList className="h-4 w-4" /> Enter This Month's Data
          </Link>
          <Link
            to="/communications/reminders"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)] shadow-sm transition lift hover:bg-[var(--gold-2)]"
          >
            <Bell className="h-4 w-4" /> Send Reminders
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          tone="navy"
          label="Active Subscribers"
          value={data?.subscribers ?? "—"}
          hint="Total active members"
        />
        <StatCard
          icon={Layers3}
          tone="gold"
          label="Active Chit Groups"
          value={data?.groups ?? "—"}
          hint={`${data?.pendingEntry?.length ?? 0} awaiting entry`}
        />
        <StatCard
          icon={Send}
          tone="green"
          label={`Dispatched (${monthLabel.split(" ")[0]})`}
          value={`${data?.sentThisMonth ?? 0}/${data?.totalDispatch ?? 0}`}
          hint="Statements delivered this month"
          progress={data ? (data.totalDispatch ? (data.sentThisMonth / data.totalDispatch) * 100 : 0) : 0}
        />
        <StatCard
          icon={AlertTriangle}
          tone="red"
          label="Failed Deliveries"
          value={data?.failed?.length ?? 0}
          hint={data?.failed?.length ? "Requires attention" : "All clear"}
        />
      </div>

      {/* Main grid: today (60) + quick actions (40) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Today's activity */}
        <section className="lg:col-span-3 rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">Today's Activity</h2>
              <p className="text-xs text-muted-foreground">Auctions scheduled for the {today}{ordinal(today)}</p>
            </div>
            <Link to="/data-entry" className="text-xs font-semibold text-navy-3 hover:underline inline-flex items-center gap-1">
              Open data entry <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </header>
          <div className="overflow-x-auto">
            {(data?.todayGroups?.length ?? 0) === 0 ? (
              <EmptyState message="No auctions today" subtle="Quiet day. Use it to catch up on data entry." />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left">Group</th>
                    <th className="px-5 py-3 text-right">Chit Value</th>
                    <th className="px-5 py-3 text-left">Auction Time</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data!.todayGroups.map((g: any, i: number) => (
                    <tr key={g.id} className="row-enter hover:bg-surface-2/60" style={{ animationDelay: `${i * 40}ms` }}>
                      <td className="px-5 py-3">
                        <div className="font-mono font-semibold text-navy">{g.group_code}</div>
                      </td>
                      <td className="px-5 py-3 text-right num font-semibold">{formatINR(g.chit_value)}</td>
                      <td className="px-5 py-3 text-text-2">{g.auction_time || "5:00 PM"}</td>
                      <td className="px-5 py-3 text-right">
                        <Link to="/data-entry" className="text-xs font-semibold text-navy-3 hover:underline">Enter result →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Quick actions + Upcoming */}
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5">
            <h3 className="text-base font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <QuickAction to="/data-entry" Icon={ClipboardList} label="Enter month data" tone="navy" />
              <QuickAction to="/communications/reminders" Icon={Bell} label="Send reminders" tone="gold" />
              <QuickAction to="/communications/receipts" Icon={ReceiptIcon} label="Create receipt" tone="green" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5">
            <h3 className="text-base font-semibold mb-3">Upcoming Auctions <span className="text-xs font-normal text-muted-foreground">· next 7 days</span></h3>
            {(data?.upcomingAuctions?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No auctions in the next 7 days.</p>
            ) : (
              <ul className="space-y-1.5">
                {data!.upcomingAuctions.slice(0, 6).map((g: any) => (
                  <li key={g.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-gold-light text-navy">
                      <div className="text-[10px] uppercase leading-none">Day</div>
                      <div className="text-xs font-bold leading-none">{g.auction_day}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold text-navy">{g.group_code}</div>
                      <div className="text-[11px] text-muted-foreground num">{formatINR(g.chit_value)}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold">Recent Dispatches</h3>
            <Link to="/communications/reminders" className="text-xs font-semibold text-navy-3 hover:underline">View all →</Link>
          </header>
          {(data?.recentDispatch?.length ?? 0) === 0 ? (
            <EmptyState message="No dispatches yet this month" subtle="Run reminders to begin." />
          ) : (
            <ul className="divide-y divide-border">
              {data!.recentDispatch.slice(0, 8).map((d: any) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60">
                  <Avatar name={d.subscribers?.name || "?"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.subscribers?.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{d.subscribers?.access_code} · {d.whatsapp_number}</div>
                  </div>
                  <StatusPill status={d.status} />
                  <span className="hidden text-[11px] text-muted-foreground sm:block num">
                    {d.sent_at ? formatDateDMY(d.sent_at) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Failed Deliveries
            </h3>
            <span className="text-xs text-muted-foreground">{data?.failed?.length ?? 0} pending</span>
          </header>
          {(data?.failed?.length ?? 0) === 0 ? (
            <EmptyState message="Zero failures" subtle="All deliveries are healthy." />
          ) : (
            <ul className="divide-y divide-border">
              {data!.failed.map((f: any) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-3 bg-destructive-bg/40">
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{f.subscribers?.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{f.last_error || "Delivery failed"}</div>
                  </div>
                  <button className="rounded-md border border-border-2 bg-surface px-3 py-1 text-xs font-semibold hover:border-navy-2">
                    Resend
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function StatCard({ icon: Icon, tone, label, value, hint, progress }: {
  icon: typeof Users; tone: "navy" | "gold" | "green" | "red";
  label: string; value: number | string; hint?: string; progress?: number;
}) {
  const toneMap = {
    navy:  { bg: "bg-navy/10",     fg: "text-navy"        },
    gold:  { bg: "bg-gold-light",  fg: "text-[var(--gold-2)]" },
    green: { bg: "bg-success-bg",  fg: "text-success"     },
    red:   { bg: "bg-destructive-bg", fg: "text-destructive" },
  } as const;
  const t = toneMap[tone];
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] lift">
      <div className={"mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg " + t.bg + " " + t.fg}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-bold tracking-tight num">{value}</div>
      <div className="text-xs text-text-2 mt-1">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1.5">{hint}</div>}
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </div>
  );
}

function QuickAction({ to, Icon, label, tone }: { to: string; Icon: typeof Bell; label: string; tone: "navy" | "gold" | "green" }) {
  const toneMap = {
    navy:  "bg-navy text-white hover:bg-navy-2",
    gold:  "bg-[var(--gold)] text-[var(--navy)] hover:bg-[var(--gold-2)]",
    green: "bg-success text-white hover:opacity-90",
  } as const;
  return (
    <Link to={to} className={"flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold transition lift " + toneMap[tone]}>
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; Icon: typeof CheckCircle2; label: string }> = {
    sent:      { bg: "bg-success-bg",     fg: "text-success",     Icon: CheckCircle2, label: "Sent" },
    delivered: { bg: "bg-success-bg",     fg: "text-success",     Icon: CheckCircle2, label: "Delivered" },
    read:      { bg: "bg-info-bg",        fg: "text-info",        Icon: CheckCircle2, label: "Read" },
    pending:   { bg: "bg-warning-bg",     fg: "text-warning",     Icon: Clock,        label: "Pending" },
    queued:    { bg: "bg-warning-bg",     fg: "text-warning",     Icon: Clock,        label: "Queued" },
    failed:    { bg: "bg-destructive-bg", fg: "text-destructive", Icon: XCircle,      label: "Failed" },
  };
  const c = map[status] || map.pending;
  const I = c.Icon;
  return (
    <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " + c.bg + " " + c.fg}>
      <I className="h-3 w-3" /> {c.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[10px] font-bold text-white">
      {initials}
    </div>
  );
}

function EmptyState({ message, subtle }: { message: string; subtle?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{message}</p>
      {subtle && <p className="text-xs text-muted-foreground mt-1">{subtle}</p>}
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
