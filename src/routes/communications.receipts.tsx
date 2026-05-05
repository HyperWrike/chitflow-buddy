import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { db } from "@/lib/db-types";
import { Bell, Gift, Receipt, Search, Printer, Send, CheckCircle2 } from "lucide-react";
import { currentMonth, formatINR, formatDateDMY, formatMonth } from "@/lib/format";
import { computeGroupTotals, computeMemberDue } from "@/lib/calculator";
import { printElement } from "@/lib/printable";
import { toast } from "sonner";
import {
  getDemoGroups,
  getDemoMonthlyEntries,
  getDemoStatements,
  getDemoSubscribers,
  getDemoSubscriptions,
} from "@/lib/demo-data";
import { useDemoSync } from "@/lib/use-demo-sync";

export const Route = createFileRoute("/communications/receipts")({
  component: () => (
    <ProtectedLayout>
      <ReceiptsPage />
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Receipts — Panasuna Chits" }] }),
});

type SubscriberLite = { id: string; access_code: string; name: string; whatsapp_number: string; address_line1: string | null; address_line2: string | null; city: string; pincode: string | null };
type ReceiptLine = { subscriptionId: string; groupCode: string; chitValue: number; durationMonths: number; amountDue: number; prized: boolean; seatCount: number; auctionDay?: number | null };

function ReceiptsPage() {
  const month = currentMonth();
  const [search, setSearch] = useState("");
  const [selectedSub, setSelectedSub] = useState<SubscriberLite | null>(null);
  const [selectedSubIds, setSelectedSubIds] = useState<Set<string>>(new Set());
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentRef, setPaymentRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  useDemoSync([["subs-search"], ["sub-receipt-detail"]]);

  const subs = useQuery({
    queryKey: ["subs-search", search],
    queryFn: async () => {
      const q = db.from("subscribers").select("id, access_code, name, whatsapp_number, address_line1, address_line2, city, pincode").eq("active", true).limit(50);
      if (search.trim()) {
        q.or(`name.ilike.%${search}%,access_code.ilike.%${search}%,whatsapp_number.ilike.%${search}%`);
      }
      const { data } = await q;
      if (!data?.length) {
        const term = search.trim().toLowerCase();
        const local = getDemoSubscribers()
          .filter((s) => s.active)
          .filter((s) =>
            !term ||
            s.name.toLowerCase().includes(term) ||
            s.access_code.toLowerCase().includes(term) ||
            s.whatsapp_number.includes(term),
          )
          .slice(0, 50)
          .map(({ id, access_code, name, whatsapp_number, address_line1, address_line2, city, pincode }) => ({
            id, access_code, name, whatsapp_number, address_line1, address_line2, city, pincode,
          }));
        return local as SubscriberLite[];
      }
      return data as SubscriberLite[];
    },
    enabled: !selectedSub,
  });

  const subDetail = useQuery({
    queryKey: ["sub-receipt-detail", selectedSub?.id, month],
    enabled: !!selectedSub,
    queryFn: async () => {
      const importedStatements = getDemoStatements(undefined, selectedSub!.id).filter((statement: any) => statement.source !== "seed");
      const preferredMonth = importedStatements.slice().sort((a: any, b: any) => (b.imported_at ?? "").localeCompare(a.imported_at ?? ""))[0]?.month;
      const demoStatements = preferredMonth ? importedStatements.filter((statement) => statement.month === preferredMonth) : [];

      if (demoStatements.length) {
        const demoGroups = getDemoGroups();
        const demoSubscriptions = getDemoSubscriptions().filter((subscription) => subscription.subscriber_id === selectedSub!.id && subscription.active !== false);
        const lines: ReceiptLine[] = demoStatements
          .map((statement) => {
            const group = demoGroups.find((item) => item.id === statement.group_id);
            if (!group) return null;
            const subscription = demoSubscriptions.find((item) => item.group_id === group.id);
            return {
              subscriptionId: subscription?.id ?? statement.group_id,
              groupCode: statement.group_code || group.group_code,
              chitValue: statement.chit_value || group.chit_value,
              durationMonths: statement.period_months || group.duration_months,
              seatCount: subscription?.seat_count ?? 1,
              prized: statement.prized,
              amountDue: statement.chit_amount_due ?? 0,
              auctionDay: statement.auction_day ?? group.auction_day,
            };
          })
          .filter(Boolean) as ReceiptLine[];

        const latest = demoStatements[0] as any;
        return {
          month: preferredMonth,
          lines,
          imported: true,
          subscriber: {
            id: selectedSub!.id,
            access_code: latest.access_code || selectedSub!.access_code,
            name: latest.subscriber_name || selectedSub!.name,
            whatsapp_number: latest.whatsapp_number || selectedSub!.whatsapp_number,
            address_line1: latest.address_line1 || selectedSub!.address_line1,
            address_line2: latest.address_line2 || selectedSub!.address_line2,
            city: latest.city || selectedSub!.city,
            pincode: latest.pincode || selectedSub!.pincode,
          } satisfies SubscriberLite,
        };
      }

      const { data: dbSubscriptions } = await db
        .from("subscriptions")
        .select("id, seat_count, prized, group_id, name_on_chit, chit_groups!inner(id, group_code, chit_value, duration_months, commission_rate, status)")
        .eq("subscriber_id", selectedSub!.id)
        .eq("active", true);

      let subscriptions: any[] = dbSubscriptions ?? [];
      if (!subscriptions.length) {
        const localSubs = getDemoSubscriptions().filter((s) => s.subscriber_id === selectedSub!.id && s.active !== false);
        const localGroups = getDemoGroups();
        subscriptions = localSubs.map((s) => {
          const g = localGroups.find((x) => x.id === s.group_id);
          if (!g) return null;
          return {
            id: s.id, seat_count: s.seat_count, prized: s.prized, group_id: s.group_id, name_on_chit: s.name_on_chit,
            chit_groups: { id: g.id, group_code: g.group_code, chit_value: g.chit_value, duration_months: g.duration_months, commission_rate: g.commission_rate, status: g.status },
          };
        }).filter(Boolean);
      }
      if (!subscriptions.length) return [];

      const groupIds = subscriptions.map((s: any) => s.group_id);
      const { data: dbEntries } = await db
        .from("monthly_entries")
        .select("id, group_id, winning_bid")
        .eq("month", month)
        .in("group_id", groupIds);
      const entries = dbEntries?.length
        ? dbEntries
        : getDemoMonthlyEntries(month).filter((e) => groupIds.includes(e.group_id)).map((e) => ({ id: e.id, group_id: e.group_id, winning_bid: e.winning_bid }));

      const { data: dbAllSubs } = await db
        .from("subscriptions")
        .select("group_id, seat_count")
        .in("group_id", groupIds)
        .eq("active", true);
      const allSubs = dbAllSubs?.length
        ? dbAllSubs
        : getDemoSubscriptions().filter((s) => groupIds.includes(s.group_id) && s.active !== false).map((s) => ({ group_id: s.group_id, seat_count: s.seat_count }));

      return {
        month,
        lines: subscriptions.map((s: any) => {
        const grp = s.chit_groups;
        const entry = entries?.find((e: any) => e.group_id === s.group_id);
        const totalSeats = (allSubs ?? []).filter((x: any) => x.group_id === s.group_id).reduce((sum: number, x: any) => sum + x.seat_count, 0);
        const baseInstall = grp.chit_value / grp.duration_months;
        let amountDue = baseInstall * s.seat_count;
        if (entry) {
          const totals = computeGroupTotals({
            chit_value: grp.chit_value,
            duration_months: grp.duration_months,
            winning_bid: entry.winning_bid,
            commission_rate: grp.commission_rate,
            total_seats_in_group: totalSeats,
          });
          const due = computeMemberDue({
            base_installment: totals.base_installment,
            per_seat_discount: totals.per_seat_discount,
            seat_count: s.seat_count,
            prized: s.prized,
          });
          amountDue = due.chit_amount_due;
        }
        return {
          subscriptionId: s.id,
          groupId: grp.id,
          groupCode: grp.group_code,
          chitValue: grp.chit_value,
          durationMonths: grp.duration_months,
          seatCount: s.seat_count,
          prized: s.prized,
          amountDue,
          monthlyEntryId: entry?.id ?? null,
        };
        }),
        imported: false,
      };
    },
  });

  const lines = subDetail.data?.lines ?? [];
  const importedReceipt = subDetail.data?.imported === true;
  const receiptSubscriber = subDetail.data?.subscriber ?? selectedSub;
  const receiptMonth = subDetail.data?.month ?? month;
  const totalSelected = useMemo(
    () => lines.filter((l) => selectedSubIds.has(l.subscriptionId)).reduce((sum, l) => sum + l.amountDue, 0),
    [lines, selectedSubIds],
  );
  const previewLines = importedReceipt ? lines : lines.filter((l) => selectedSubIds.has(l.subscriptionId));
  const totalPreview = importedReceipt ? lines.reduce((sum, line) => sum + line.amountDue, 0) : totalSelected;

  const toggle = (id: string) => {
    setSelectedSubIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const reset = () => {
    setSelectedSub(null);
    setSelectedSubIds(new Set());
    setPaymentRef("");
    setSearch("");
  };

  const saveAndSend = async (alsoPrint: boolean) => {
    if (!selectedSub || (!importedReceipt && selectedSubIds.size === 0)) return;
    setSubmitting(true);
    try {
      const paid = importedReceipt ? lines : lines.filter((l) => selectedSubIds.has(l.subscriptionId));
      // Mark dues paid where we have monthly entries
      for (const line of paid) {
        if (!line.monthlyEntryId) continue;
        await db
          .from("member_dues")
          .update({
            paid: true,
            paid_at: new Date().toISOString(),
            paid_amount: Math.round(line.amountDue),
            payment_mode: paymentMode,
            payment_ref: paymentRef || null,
          })
          .eq("subscription_id", line.subscriptionId)
          .eq("monthly_entry_id", line.monthlyEntryId);
      }
      // Log dispatch as if sent
      await db.from("dispatch_log").insert({
        subscriber_id: selectedSub.id,
        type: "receipt",
        month,
        whatsapp_number: selectedSub.whatsapp_number,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      toast.success(`Receipt recorded for ${selectedSub.name} — ${formatINR(importedReceipt ? totalPreview : totalSelected)}`);
      if (alsoPrint) printElement("receipt-printable", `Receipt — ${selectedSub.name}`);
      qc.invalidateQueries();
      setTimeout(reset, 600);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to record receipt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display">Receipts</h1>
        <p className="text-text-2">Tick paid groups, generate live receipt, send via WhatsApp.</p>
      </div>
      <Tabs active="receipts" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT */}
        <div className="space-y-4">
          {!selectedSub ? (
            <div className="rounded-xl border bg-surface p-4">
              <label className="block text-sm font-medium mb-2">Find subscriber</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background"
                  placeholder="Search by name, code or phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {subs.data ? (
                  <>Showing {subs.data.length} {search.trim() ? "matching" : "active"} subscriber{subs.data.length === 1 ? "" : "s"}{subs.data.length === 50 ? " (refine search to narrow)" : ""}</>
                ) : "Loading…"}
              </div>
              <div className="mt-2 max-h-96 overflow-auto rounded-lg border divide-y">
                {(subs.data ?? []).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSub(s)}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.access_code} · {s.whatsapp_number}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">{s.city}</span>
                  </button>
                ))}
                {subs.data && subs.data.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">No subscribers found.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border bg-surface p-4 flex justify-between items-start">
                <div>
                  <div className="text-xs text-muted-foreground">Selected</div>
                  <div className="font-semibold">{selectedSub.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedSub.access_code} · {selectedSub.whatsapp_number}</div>
                </div>
                <button onClick={reset} className="text-xs text-muted-foreground underline">Change</button>
              </div>

              <div className="rounded-xl border bg-surface p-4">
                <div className="font-medium mb-3">Active groups · {formatMonth(month)}</div>
                {subDetail.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
                <div className="space-y-2">
                  {lines.map((l) => (
                    <label key={l.subscriptionId} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer">
                      <input type="checkbox" checked={selectedSubIds.has(l.subscriptionId)} onChange={() => toggle(l.subscriptionId)} />
                      <div className="flex-1">
                        <div className="font-medium">{l.groupCode} {l.prized && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">PRIZED</span>}</div>
                        <div className="text-xs text-muted-foreground">{formatINR(l.chitValue)} · {l.seatCount} seat{l.seatCount > 1 ? "s" : ""} · {l.monthlyEntryId ? "Entry locked" : "No entry yet"}</div>
                      </div>
                      <div className="font-mono font-semibold">{formatINR(l.amountDue)}</div>
                    </label>
                  ))}
                  {lines.length === 0 && !subDetail.isLoading && (
                    <div className="text-sm text-muted-foreground py-4 text-center">No active subscriptions.</div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-sm">Total selected</span>
                  <span className="font-mono text-lg font-bold">{formatINR(totalSelected)}</span>
                </div>
              </div>

              <div className="rounded-xl border bg-surface p-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs">Payment mode</label>
                  <select className="w-full mt-1 px-2 py-2 rounded border" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs">Payment date</label>
                  <input type="date" className="w-full mt-1 px-2 py-2 rounded border" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs">Transaction ref (optional)</label>
                  <input className="w-full mt-1 px-2 py-2 rounded border" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="UTR / Cheque no / UPI ref" />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={selectedSubIds.size === 0 || submitting}
                  onClick={() => saveAndSend(false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Save & Send via WhatsApp
                </button>
                <button
                  disabled={selectedSubIds.size === 0 || submitting}
                  onClick={() => saveAndSend(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" /> Save & Print PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — preview */}
        <div>
          <div className="text-sm text-muted-foreground mb-2">Live receipt preview</div>
          <ReceiptPreview
            subscriber={receiptSubscriber}
            lines={previewLines}
            totalSelected={totalPreview}
            paymentMode={paymentMode}
            paymentDate={paymentDate}
            paymentRef={paymentRef}
            month={receiptMonth}
          />
        </div>
      </div>
    </div>
  );
}

function ReceiptPreview({
  subscriber, lines, totalSelected, paymentMode, paymentDate, paymentRef, month,
}: {
  subscriber: SubscriberLite | null;
  lines: ReceiptLine[];
  totalSelected: number;
  paymentMode: string;
  paymentDate: string;
  paymentRef: string;
  month: string;
}) {
  return (
    <div id="receipt-printable" className="printable bg-white border rounded-xl overflow-hidden shadow-sm" style={{ minHeight: 700 }}>
      <div style={{ background: "#0f2744", color: "white", padding: "20px 28px" }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0.5 }}>Panasuna Chits (P) Ltd</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>413-C Big Bazaar Street, Salem – 636 007 · (A ROSCA Institution)</div>
      </div>
      <div style={{ background: "#f5a623", color: "#0f2744", padding: "8px 28px", fontWeight: 600, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
        <span>Phone: 9842567890</span>
        <span>ACKNOWLEDGEMENT RECEIPT</span>
        <span>{paymentDate}</span>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {subscriber ? (
          <>
            <div style={{ marginBottom: 18, fontSize: 14, lineHeight: 1.6 }}>
              <strong>{subscriber.name}</strong><br />
              {subscriber.address_line1}{subscriber.address_line2 ? `, ${subscriber.address_line2}` : ""}<br />
              {subscriber.city} – {subscriber.pincode}<br />
              <span style={{ color: "#6b7280", fontSize: 12 }}>Code: {subscriber.access_code}</span>
            </div>

            <div style={{ background: "#ddeeff", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              Dear Sir/Madam, we have received your <strong>{paymentMode.replace("_", " ")}</strong> of <strong>{formatINR(totalSelected)}</strong> dated {formatDateDMY(paymentDate)} for {formatMonth(month)}.
              {paymentRef && <> Ref: <strong>{paymentRef}</strong>.</>}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0f2744", color: "white" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Group</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Chit Value</th>
                  <th style={{ textAlign: "center", padding: "10px 12px" }}>Seats</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.subscriptionId} style={{ background: i % 2 === 0 ? "white" : "#f5f8ff" }}>
                    <td style={{ padding: "10px 12px" }}>{l.groupCode}{l.prized ? " (Prized)" : ""}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{formatINR(l.chitValue)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{l.seatCount}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{formatINR(l.amountDue)}</td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>Select groups to include on the receipt</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f5a623", color: "#0f2744", fontWeight: 700 }}>
                  <td style={{ padding: "10px 12px" }} colSpan={3}>Total Received</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{formatINR(totalSelected)}</td>
                </tr>
              </tfoot>
            </table>

            <div style={{ marginTop: 28, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
              Watch your investment grow with us — Panasuna Chits (P) Ltd
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
            <CheckCircle2 style={{ margin: "0 auto", height: 48, width: 48, opacity: 0.4 }} />
            <div style={{ marginTop: 12 }}>Search and select a subscriber to preview their receipt</div>
          </div>
        )}
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
