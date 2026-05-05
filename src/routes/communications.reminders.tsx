import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/db-types";
import { Bell, Gift, Receipt, Send, Printer, RefreshCw, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, formatINR, formatDateDMY, formatMonth, monthOptions } from "@/lib/format";
import { computeGroupTotals, computeMemberDue } from "@/lib/calculator";
import { printElement } from "@/lib/printable";
import { toast } from "sonner";
import {
  addDemoDispatches,
  ensureDemoState,
  getDemoDispatches,
  getDemoGroups,
  getDemoMonthlyEntries,
  getDemoStatements,
  getDemoSubscribers,
  getDemoSubscriptions,
} from "@/lib/demo-data";
import { useDemoSync } from "@/lib/use-demo-sync";

export const Route = createFileRoute("/communications/reminders")({
  component: () => (
    <ProtectedLayout>
      <RemindersPage />
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Reminders — Panasuna Chits" }] }),
});

type Row = {
  subscriberId: string;
  name: string;
  accessCode: string;
  phone: string;
  address1: string | null;
  city: string;
  pincode: string | null;
  groups: { groupCode: string; chitValue: number; auctionDay: number; amountDue: number; prized: boolean; seatCount: number }[];
  totalDue: number;
  dispatchStatus?: string;
};

const PAGE_SIZE = 50;

function RemindersPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [previewIdx, setPreviewIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "pending" | "failed">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    ensureDemoState();
    qc.invalidateQueries({ queryKey: ["reminders-rows"] });
  }, [qc]);

  useDemoSync([["reminders-rows", month]]);

  const data = useQuery({
    queryKey: ["reminders-rows", month],
    queryFn: async (): Promise<Row[]> => {
      const demoStatements = getDemoStatements(month);
      if (demoStatements.length) {
        const demoGroups = getDemoGroups();
        const demoSubscribers = getDemoSubscribers();
        const demoSubscriptions = getDemoSubscriptions();

        const { data: dbDispatch } = await db
          .from("dispatch_log")
          .select("subscriber_id, status")
          .eq("month", month)
          .eq("type", "reminder");
        const dispatches = dbDispatch ?? getDemoDispatches(month, "reminder").map((d) => ({ subscriber_id: d.subscriber_id, status: d.status }));
        const dispatchBySub = new Map<string, string>();
        dispatches.forEach((d: any) => dispatchBySub.set(d.subscriber_id, d.status));

        const bySub = new Map<string, Row>();
        demoStatements.forEach((statement) => {
          const subscriber = demoSubscribers.find((item) => item.id === statement.subscriber_id);
          const group = demoGroups.find((item) => item.id === statement.group_id);
          if (!subscriber || !group) return;
          const subscription = demoSubscriptions.find((item) => item.subscriber_id === subscriber.id && item.group_id === group.id);
          const amountDue = statement.chit_amount_due ?? 0;
          const row: Row = bySub.get(subscriber.id) ?? {
            subscriberId: subscriber.id,
            name: subscriber.name,
            accessCode: subscriber.access_code,
            phone: subscriber.whatsapp_number,
            address1: subscriber.address_line1,
            city: subscriber.city,
            pincode: subscriber.pincode,
            groups: [],
            totalDue: 0,
            dispatchStatus: dispatchBySub.get(subscriber.id),
          };
          row.groups.push({
            groupCode: statement.group_code || group.group_code,
            chitValue: statement.chit_value || group.chit_value,
            auctionDay: statement.auction_day ?? group.auction_day,
            amountDue,
            prized: statement.prized,
            seatCount: subscription?.seat_count ?? 1,
          });
          row.totalDue += amountDue;
          bySub.set(subscriber.id, row);
        });

        return Array.from(bySub.values()).sort((a, b) => a.name.localeCompare(b.name));
      }

      const mapDemoEntries = () => {
        const demoGroups = getDemoGroups();
        const demoEntries = getDemoMonthlyEntries(month);
        return demoEntries
          .map((e) => {
            const g = demoGroups.find((x) => x.id === e.group_id);
            if (!g) return null;
            return {
              id: e.id,
              group_id: e.group_id,
              winning_bid: e.winning_bid,
              locked: e.locked,
              chit_groups: {
                id: g.id,
                group_code: g.group_code,
                chit_value: g.chit_value,
                duration_months: g.duration_months,
                commission_rate: g.commission_rate,
                auction_day: g.auction_day,
              },
            };
          })
          .filter(Boolean);
      };

      const mapDemoSubscriptions = (groupIds: string[]) => {
        const demoSubscriptions = getDemoSubscriptions().filter((s) => groupIds.includes(s.group_id) && s.active !== false);
        const demoSubscribers = getDemoSubscribers();
        return demoSubscriptions
          .map((s) => {
            const sub = demoSubscribers.find((x) => x.id === s.subscriber_id);
            if (!sub) return null;
            return {
              id: s.id,
              subscriber_id: s.subscriber_id,
              group_id: s.group_id,
              seat_count: s.seat_count,
              prized: s.prized,
              subscribers: {
                id: sub.id,
                name: sub.name,
                access_code: sub.access_code,
                whatsapp_number: sub.whatsapp_number,
                address_line1: sub.address_line1,
                city: sub.city,
                pincode: sub.pincode,
              },
            };
          })
          .filter(Boolean);
      };

      const { data: dbEntries } = await db
        .from("monthly_entries")
        .select("id, group_id, winning_bid, locked, chit_groups!inner(id, group_code, chit_value, duration_months, commission_rate, auction_day)")
        .eq("month", month);

      let entries: any[] = dbEntries ?? [];
      let subs: any[] = [];
      let dispatches: any[] = [];

      if (!entries.length) {
        entries = mapDemoEntries();
      }
      if (!entries.length) return [];

      const groupIds = entries.map((e: any) => e.group_id);

      const { data: dbSubs } = await db
        .from("subscriptions")
        .select("id, subscriber_id, group_id, seat_count, prized, subscribers!inner(id, name, access_code, whatsapp_number, address_line1, city, pincode)")
        .in("group_id", groupIds)
        .eq("active", true);
      subs = dbSubs ?? [];
      if (!subs.length) {
        subs = mapDemoSubscriptions(groupIds);

        // In partial-RLS scenarios, db monthly entries may be readable while subscriptions are not.
        // Switch fully to demo entries when they have usable subscriber data.
        if (!subs.length) {
          const demoEntries = mapDemoEntries();
          const demoGroupIds = demoEntries.map((e: any) => e.group_id);
          const demoSubs = mapDemoSubscriptions(demoGroupIds);
          if (demoEntries.length && demoSubs.length) {
            entries = demoEntries;
            subs = demoSubs;
          }
        }
      }
      if (!subs.length) return [];

      const seatTotals = new Map<string, number>();
      subs.forEach((s: any) => seatTotals.set(s.group_id, (seatTotals.get(s.group_id) ?? 0) + s.seat_count));

      const { data: dbDispatch } = await db
        .from("dispatch_log")
        .select("subscriber_id, status")
        .eq("month", month)
        .eq("type", "reminder");
      dispatches = dbDispatch ?? [];
      if (!dispatches.length) {
        dispatches = getDemoDispatches(month, "reminder").map((d) => ({ subscriber_id: d.subscriber_id, status: d.status }));
      }
      const dispatchBySub = new Map<string, string>();
      dispatches.forEach((d: any) => dispatchBySub.set(d.subscriber_id, d.status));

      const bySub = new Map<string, Row>();
      subs.forEach((s: any) => {
        const subscriber = s.subscribers;
        const entry = entries.find((e: any) => e.group_id === s.group_id);
        const grp = entry.chit_groups;
        const totals = computeGroupTotals({
          chit_value: grp.chit_value,
          duration_months: grp.duration_months,
          winning_bid: entry.winning_bid,
          commission_rate: grp.commission_rate,
          total_seats_in_group: seatTotals.get(s.group_id) ?? 0,
        });
        const due = computeMemberDue({
          base_installment: totals.base_installment,
          per_seat_discount: totals.per_seat_discount,
          seat_count: s.seat_count,
          prized: s.prized,
        });
        const row: Row = bySub.get(subscriber.id) ?? {
          subscriberId: subscriber.id,
          name: subscriber.name,
          accessCode: subscriber.access_code,
          phone: subscriber.whatsapp_number,
          address1: subscriber.address_line1,
          city: subscriber.city,
          pincode: subscriber.pincode,
          groups: [],
          totalDue: 0,
          dispatchStatus: dispatchBySub.get(subscriber.id),
        };
        row.groups.push({
          groupCode: grp.group_code,
          chitValue: grp.chit_value,
          auctionDay: grp.auction_day,
          amountDue: due.chit_amount_due,
          prized: s.prized,
          seatCount: s.seat_count,
        });
        row.totalDue += due.chit_amount_due;
        bySub.set(subscriber.id, row);
      });

      return Array.from(bySub.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const allRows = data.data ?? [];

  const groupOptions = useMemo(() => {
    const codes = new Set<string>();
    allRows.forEach((r) => r.groups.forEach((g) => codes.add(g.groupCode)));
    return Array.from(codes).sort();
  }, [allRows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (term) {
        const hay = `${r.name} ${r.accessCode} ${r.phone}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (statusFilter !== "all") {
        const st = r.dispatchStatus ?? "pending";
        if (st !== statusFilter) return false;
      }
      if (groupFilter !== "all") {
        if (!r.groups.some((g) => g.groupCode === groupFilter)) return false;
      }
      return true;
    });
  }, [allRows, search, statusFilter, groupFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const rows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);
  const previewRow = rows[previewIdx] ?? rows[0];

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setGroupFilter("all");
    setPage(0);
  };

  const sendOne = async (sub: Row) => {
    setBusy(true);
    try {
      const row = {
        subscriber_id: sub.subscriberId,
        type: "reminder",
        month,
        whatsapp_number: sub.phone,
        status: "sent",
        sent_at: new Date().toISOString(),
      };
      await db.from("dispatch_log").insert(row);
      addDemoDispatches([row]);
      toast.success(`Reminder logged for ${sub.name}`);
      qc.invalidateQueries({ queryKey: ["reminders-rows"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendAll = async () => {
    if (filteredRows.length === 0) return;
    if (!confirm(`Send reminders to all ${filteredRows.length} subscribers? (mock — no real WhatsApp dispatch)`)) return;
    setBusy(true);
    try {
      const toInsert = filteredRows.map((r) => ({
        subscriber_id: r.subscriberId,
        type: "reminder",
        month,
        whatsapp_number: r.phone,
        status: "sent",
        sent_at: new Date().toISOString(),
      }));
      await db.from("dispatch_log").insert(toInsert);
      addDemoDispatches(toInsert);
      toast.success(`Sent ${filteredRows.length} reminders`);
      qc.invalidateQueries({ queryKey: ["reminders-rows"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display">Reminders</h1>
        <p className="text-text-2">Generate monthly auction notices and dispatch via WhatsApp.</p>
      </div>
      <Tabs active="reminders" />

      <div className="flex flex-wrap items-center gap-3">
        <select className="px-3 py-2 rounded border bg-surface text-sm" value={month} onChange={(e) => { setMonth(e.target.value); setPreviewIdx(0); }}>
          {monthOptions(12).map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button onClick={() => qc.invalidateQueries({ queryKey: ["reminders-rows"] })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded border text-sm hover:bg-accent">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={() => previewRow && printElement("reminder-printable", `Statement — ${previewRow.name}`)} disabled={!previewRow} className="inline-flex items-center gap-1.5 px-3 py-2 rounded border text-sm disabled:opacity-50">
            <Printer className="h-4 w-4" /> Print preview
          </button>
          <button onClick={sendAll} disabled={busy || filteredRows.length === 0} className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50">
            <Send className="h-4 w-4" /> Send all ({filteredRows.length})
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, code, or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-8 pr-3 py-2 rounded border bg-surface text-sm"
          />
        </div>
        <select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(0); }} className="px-3 py-2 rounded border bg-surface text-sm">
          <option value="all">All groups</option>
          {groupOptions.map((g) => (<option key={g} value={g}>{g}</option>))}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(0); }} className="px-3 py-2 rounded border bg-surface text-sm">
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        {(search || statusFilter !== "all" || groupFilter !== "all") && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 px-2.5 py-2 rounded border text-xs hover:bg-accent">
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          Showing {filteredRows.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
          {filteredRows.length !== allRows.length && ` (filtered from ${allRows.length})`}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-surface overflow-hidden">
          <div className="px-4 py-2 border-b text-sm font-medium bg-muted/40">Dispatch list — {formatMonth(month)}</div>
          <div className="max-h-[640px] overflow-auto divide-y">
            {data.isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
            {!data.isLoading && filteredRows.length === 0 && allRows.length === 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No monthly entries found for {formatMonth(month)}.<br />
                Enter monthly auction data first to generate reminders.
              </div>
            )}
            {!data.isLoading && filteredRows.length === 0 && allRows.length > 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No subscribers match your filters.
              </div>
            )}
            {rows.map((r, i) => (
              <button
                key={r.subscriberId}
                onClick={() => setPreviewIdx(i)}
                className={"w-full text-left px-4 py-3 hover:bg-accent flex items-center gap-3 " + (i === previewIdx ? "bg-accent" : "")}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.accessCode} · {r.phone} · {r.groups.length} group{r.groups.length > 1 ? "s" : ""}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">{formatINR(r.totalDue)}</div>
                  {r.dispatchStatus ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium uppercase">{r.dispatchStatus}</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium uppercase">pending</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); sendOne(r); }}
                  className="ml-2 px-2 py-1 text-xs rounded border hover:bg-muted"
                  title="Send reminder"
                >
                  <Send className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs">
              <button
                disabled={safePage === 0}
                onClick={() => { setPage(Math.max(0, safePage - 1)); setPreviewIdx(0); }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border disabled:opacity-40"
              >
                <ChevronLeft className="h-3 w-3" /> Prev
              </button>
              <span className="text-muted-foreground">Page {safePage + 1} of {totalPages}</span>
              <button
                disabled={safePage >= totalPages - 1}
                onClick={() => { setPage(Math.min(totalPages - 1, safePage + 1)); setPreviewIdx(0); }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border disabled:opacity-40"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-2">Statement preview</div>
          {previewRow ? (
            <StatementPreview row={previewRow} month={month} />
          ) : (
            <div className="rounded-xl border p-12 text-center text-sm text-muted-foreground bg-surface">
              Select a subscriber to preview the statement
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatementPreview({ row, month }: { row: Row; month: string }) {
  return (
    <div id="reminder-printable" className="printable bg-white border rounded-xl overflow-hidden shadow-sm" style={{ minHeight: 700 }}>
      <div style={{ background: "#0f2744", color: "white", padding: "20px 28px" }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0.5 }}>Panasuna Chits (P) Ltd</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>413-C Big Bazaar Street, Salem – 636 007 · (A ROSCA Institution)</div>
      </div>
      <div style={{ background: "#f5a623", color: "#0f2744", padding: "8px 28px", fontWeight: 600, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
        <span>Phone: 9842567890</span>
        <span>Good Day Wishes !!!</span>
        <span>{row.accessCode}</span>
      </div>

      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "#0f2744" }}>
            <strong>{row.name}</strong><br />
            {row.address1}<br />
            {row.city} – {row.pincode}
          </div>
          <div style={{ fontSize: 13, textAlign: "right", color: "#0f2744" }}>
            Month: <strong>{formatMonth(month)}</strong><br />
            Auction Day: <strong>{row.groups[0]?.auctionDay}th</strong>
          </div>
        </div>

        <div style={{ background: "#ddeeff", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          Kindly note the chit amount and pay before the auction date.
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#0f2744", color: "white" }}>
              <th style={{ textAlign: "center", padding: "10px 12px" }}>Auction Day</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>Group</th>
              <th style={{ textAlign: "center", padding: "10px 12px" }}>Prized</th>
              <th style={{ textAlign: "right", padding: "10px 12px" }}>Chit Value</th>
              <th style={{ textAlign: "right", padding: "10px 12px" }}>Amount Due</th>
            </tr>
          </thead>
          <tbody>
            {row.groups.map((g, i) => (
              <tr key={g.groupCode} style={{ background: i % 2 === 0 ? "white" : "#f5f8ff" }}>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>{g.auctionDay}th</td>
                <td style={{ padding: "10px 12px" }}>{g.groupCode}</td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>{g.prized ? "Yes" : "—"}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{formatINR(g.chitValue)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{formatINR(g.amountDue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f5a623", color: "#0f2744", fontWeight: 700 }}>
              <td style={{ padding: "10px 12px" }} colSpan={4}>Total Due</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{formatINR(row.totalDue)}</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: 28, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
          Generated on {formatDateDMY(new Date())} · Panasuna Chits (P) Ltd · Watch your investment grow with us
        </div>
      </div>
    </div>
  );
}

function Tabs({ active }: { active: string }) {
  return (
    <div className="flex gap-2">
      <Tab to="/communications/reminders" label="Reminders" Icon={Bell} active={active === "reminders"} />
      <Tab to="/communications/offers" label="Offers" Icon={Gift} active={active === "offers"} />
      <Tab to="/communications/receipts" label="Receipts" Icon={Receipt} active={active === "receipts"} />
    </div>
  );
}

function Tab({ to, label, Icon, active }: { to: string; label: string; Icon: typeof Bell; active: boolean }) {
  return (
    <Link
      to={to}
      className={
        "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition " +
        (active ? "border-navy bg-navy text-white" : "border-border bg-surface text-text-2 hover:border-border-2")
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
