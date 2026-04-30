import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-types";
import { Card } from "@/components/ui/card";
import { Users, Layers3, Send, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { currentMonth, formatMonth } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Panasuna Chits" }] }),
});

function DashboardPage() {
  return (
    <ProtectedLayout>
      <Dashboard />
    </ProtectedLayout>
  );
}

function Dashboard() {
  const month = currentMonth();
  const today = new Date().getDate();

  const stats = useQuery({
    queryKey: ["dashboard-stats", month],
    queryFn: async () => {
      const [subs, groups, sent, todayGroups, monthEntries] = await Promise.all([
        db.from("subscribers").select("id", { count: "exact", head: true }).eq("active", true),
        db.from("chit_groups").select("id", { count: "exact", head: true }).eq("status", "active"),
        db.from("dispatch_log").select("id", { count: "exact", head: true }).eq("month", month).eq("status", "sent"),
        db.from("chit_groups").select("id, group_code, auction_day").eq("auction_day", today).eq("status", "active"),
        db.from("monthly_entries").select("group_id").eq("month", month),
      ]);
      const enteredGroupIds = new Set((monthEntries.data ?? []).map((e) => e.group_id));
      const allActiveGroups = await db.from("chit_groups").select("id, group_code, auction_day").eq("status", "active");
      const pendingEntry = (allActiveGroups.data ?? []).filter((g) => !enteredGroupIds.has(g.id));
      return {
        subscribers: subs.count ?? 0,
        groups: groups.count ?? 0,
        sentThisMonth: sent.count ?? 0,
        todayGroups: todayGroups.data ?? [],
        pendingEntry,
      };
    },
  });

  const cards = [
    { label: "Active Subscribers", value: stats.data?.subscribers ?? "—", icon: Users, color: "bg-primary/10 text-primary" },
    { label: "Active Chit Groups", value: stats.data?.groups ?? "—", icon: Layers3, color: "bg-gold/20 text-gold-foreground" },
    { label: `Statements Sent (${formatMonth(month)})`, value: stats.data?.sentThisMonth ?? "—", icon: Send, color: "bg-success/15 text-success" },
    { label: "Groups Pending Entry", value: stats.data?.pendingEntry?.length ?? "—", icon: AlertCircle, color: "bg-destructive/10 text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{formatMonth(month)} · Today is the {today}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/data-entry">
            <Button>Enter This Month's Data</Button>
          </Link>
          <Link to="/dispatch">
            <Button variant="outline">Open Dispatch</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-5">
              <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md ${c.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">Today's Auctions ({today})</h2>
          {(stats.data?.todayGroups?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No auctions scheduled today.</p>
          ) : (
            <ul className="divide-y">
              {stats.data?.todayGroups.map((g) => (
                <li key={g.id} className="flex items-center justify-between py-2">
                  <span className="font-medium">{g.group_code}</span>
                  <span className="text-xs text-muted-foreground">Day {g.auction_day}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">Groups Awaiting {formatMonth(month)} Entry</h2>
          {(stats.data?.pendingEntry?.length ?? 0) === 0 ? (
            <p className="text-sm text-success">All caught up. ✓</p>
          ) : (
            <ul className="divide-y max-h-64 overflow-auto">
              {stats.data?.pendingEntry.map((g) => (
                <li key={g.id} className="flex items-center justify-between py-2">
                  <span className="font-medium">{g.group_code}</span>
                  <Link to="/data-entry" className="text-xs text-primary hover:underline">
                    Enter →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
