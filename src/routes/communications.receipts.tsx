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
type ReceiptLine = {
  subscriptionId: string;
  groupCode: string;
  subscriberName: string;
  auctionDate: string | null;
  auctionTime: string | null;
  agreeNo: string | null;
  chitValue: number;
  previousBidAmount: number | null;
  cc: number | null;
  shareOfDiscount: number | null;
  periodMonths: number | null;
  chitAmountAfterIncentive: number;
  prized: boolean;
  seatCount: number;
  auctionDay?: number | null;
};

function ReceiptsPage() {
  const month = currentMonth();
  const [search, setSearch] = useState("");
  const [selectedSub, setSelectedSub] = useState<SubscriberLite | null>(null);
  const [selectedSubIds, setSelectedSubIds] = useState<Set<string>>(new Set());
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentRef, setPaymentRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [noChitEnrolled, setNoChitEnrolled] = useState(false);
  const [nonChitName, setNonChitName] = useState("");
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
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
        const lines: ReceiptLine[] = demoStatements.map((statement: any, idx: number) => ({
          subscriptionId: `${statement.group_id}::${statement.agree_no ?? statement.group_code}::${statement.seat_index ?? idx}`,
          groupCode: statement.group_code,
          subscriberName: statement.name_on_chit || statement.subscriber_name,
          auctionDate: statement.auction_date,
          auctionTime: statement.auction_time,
          agreeNo: statement.agree_no,
          chitValue: statement.chit_value,
          previousBidAmount: statement.previous_bid_amount,
          cc: statement.cc,
          shareOfDiscount: statement.share_of_discount,
          periodMonths: statement.period_months,
          chitAmountAfterIncentive: statement.chit_amount_after_incentive ?? 0,
          prized: statement.prized,
          seatCount: 1,
          auctionDay: statement.auction_day,
        }));

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
        lines: subscriptions.flatMap((s: any) => {
        const grp = s.chit_groups;
        const entry = entries?.find((e: any) => e.group_id === s.group_id);
        const totalSeats = (allSubs ?? []).filter((x: any) => x.group_id === s.group_id).reduce((sum: number, x: any) => sum + x.seat_count, 0);
        const baseInstall = grp.chit_value / grp.duration_months;
        let amountDue = baseInstall * s.seat_count;
        let perSeatDiscount = 0;
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
          perSeatDiscount = totals.per_seat_discount;
        }
        const seats = Math.max(1, Number(s.seat_count) || 1);
        const perSeatDue = amountDue / seats;
        const perSeatChitValue = grp.chit_value / seats;
        return Array.from({ length: seats }, (_, seatIdx) => ({
          subscriptionId: `${s.id}::seat${seatIdx + 1}`,
          groupId: grp.id,
          groupCode: grp.group_code,
          // Prefer the subscription's name_on_chit (captured per XLSX row) so
          // when Sundara has PS238 won by "Ranga Traders", that row shows
          // "Ranga Traders" in the receipt. Fall back to recipient name only
          // if name_on_chit is missing.
          subscriberName: s.name_on_chit || selectedSub?.name || "",
          auctionDate: String(grp.auction_day ?? ""),
          auctionTime: "5.00 PM",
          agreeNo: `${seatIdx + 1}/${grp.duration_months}`,
          chitValue: perSeatChitValue,
          previousBidAmount: entry?.winning_bid ?? 0,
          cc: Math.round((perSeatChitValue * (grp.commission_rate ?? 0)) / 100 / Math.max(grp.duration_months, 1)),
          shareOfDiscount: Math.round(perSeatDiscount),
          periodMonths: grp.duration_months,
          chitAmountAfterIncentive: perSeatDue,
          durationMonths: grp.duration_months,
          seatCount: 1,
          prized: s.prized,
          amountDue: perSeatDue,
          auctionDay: grp.auction_day ?? null,
          monthlyEntryId: entry?.id ?? null,
        }));
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
  const expectedTotal = importedReceipt ? lines.reduce((sum, line) => sum + (line.chitAmountAfterIncentive || (line as any).amountDue || 0), 0) : totalSelected;
  const amountPaidNum = (() => {
    const v = parseFloat(amountPaidInput);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  })();
  const totalPreview = noChitEnrolled ? amountPaidNum : (amountPaidInput.trim() ? amountPaidNum : expectedTotal);

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
    setNoChitEnrolled(false);
    setNonChitName("");
    setAmountPaidInput("");
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

              <label className="flex items-center gap-2 rounded-xl border bg-surface p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noChitEnrolled}
                  onChange={(e) => {
                    setNoChitEnrolled(e.target.checked);
                    if (e.target.checked) setSelectedSubIds(new Set());
                  }}
                />
                <span className="text-sm font-medium">No Chit Enrolled</span>
                <span className="text-xs text-muted-foreground">— record a payment without chit group</span>
              </label>

              {noChitEnrolled ? (
                <div className="rounded-xl border bg-surface p-4 space-y-3">
                  <div>
                    <label className="text-xs">Subscriber Name (free text)</label>
                    <input className="w-full mt-1 px-2 py-2 rounded border" value={nonChitName} onChange={(e) => setNonChitName(e.target.value)} placeholder={selectedSub.name} />
                  </div>
                </div>
              ) : (
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
              )}

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
                <div>
                  <label className="text-xs">Amount Paid</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full mt-1 px-2 py-2 rounded border font-mono"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    placeholder={!noChitEnrolled && expectedTotal ? String(Math.round(expectedTotal)) : "0"}
                  />
                </div>
                <div>
                  <label className="text-xs">Transaction ref (optional)</label>
                  <input className="w-full mt-1 px-2 py-2 rounded border" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="UTR / Cheque no / UPI ref" />
                </div>
                {!noChitEnrolled && amountPaidInput.trim() && (
                  <div className="col-span-2 rounded-md bg-muted/30 p-2 text-xs">
                    {amountPaidNum > expectedTotal ? (
                      <span className="text-emerald-700">Excess: ₹{formatINR(amountPaidNum - expectedTotal)}</span>
                    ) : amountPaidNum < expectedTotal ? (
                      <span className="text-red-700">Deficit: ₹{formatINR(expectedTotal - amountPaidNum)}</span>
                    ) : (
                      <span className="text-emerald-700">Exact Payment</span>
                    )}
                    <span className="ml-2 text-muted-foreground">(expected ₹{formatINR(expectedTotal)})</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  disabled={(noChitEnrolled ? amountPaidNum <= 0 : selectedSubIds.size === 0) || submitting}
                  onClick={() => saveAndSend(false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Save & Send via WhatsApp
                </button>
                <button
                  disabled={(noChitEnrolled ? amountPaidNum <= 0 : selectedSubIds.size === 0) || submitting}
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
            expectedTotal={expectedTotal}
            amountPaid={amountPaidInput.trim() ? amountPaidNum : (noChitEnrolled ? 0 : expectedTotal)}
            paymentMode={paymentMode}
            paymentDate={paymentDate}
            paymentRef={paymentRef}
            month={receiptMonth}
            noChitEnrolled={noChitEnrolled}
            nonChitName={nonChitName}
          />
        </div>
      </div>
    </div>
  );
}

function ReceiptPreview({
  subscriber, lines, expectedTotal, amountPaid, paymentMode, paymentDate, paymentRef, month, noChitEnrolled, nonChitName,
}: {
  subscriber: SubscriberLite | null;
  lines: ReceiptLine[];
  expectedTotal: number;
  amountPaid: number;
  paymentMode: string;
  paymentDate: string;
  paymentRef: string;
  month: string;
  noChitEnrolled: boolean;
  nonChitName: string;
}) {
  const modeLabel = paymentMode.replace("_", " ");
  const total = noChitEnrolled ? amountPaid : (amountPaid || expectedTotal);
  const showVariance = !noChitEnrolled && expectedTotal > 0;
  const variance = amountPaid - expectedTotal;

  if (!subscriber) {
    return (
      <div id="receipt-printable" className="printable bg-white border rounded-xl overflow-hidden shadow-sm" style={{ minHeight: 500 }}>
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          <CheckCircle2 style={{ margin: "0 auto", height: 48, width: 48, opacity: 0.4 }} />
          <div style={{ marginTop: 12 }}>Search and select a subscriber to preview their receipt</div>
        </div>
      </div>
    );
  }

  // Rows: one per line in the 5-col format. For noChitEnrolled, single row with Group="—".
  const rows = noChitEnrolled
    ? [{
        date: paymentDate,
        group: "—",
        name: nonChitName.trim() || subscriber.name,
        mode: modeLabel,
        amount: amountPaid,
      }]
    : lines.map((line) => ({
        date: paymentDate,
        group: line.groupCode,
        name: line.subscriberName || subscriber.name,
        mode: modeLabel,
        amount: line.chitAmountAfterIncentive || (line as any).amountDue || 0,
      }));

  return (
    <div id="receipt-printable" className="printable bg-white border rounded-lg overflow-hidden shadow-sm" style={{ fontSize: 11 }}>
      <div style={{ background: "#0f2744", color: "white", padding: "10px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>PANASUNA CHITS (P) LTD.,</div>
        <div style={{ fontSize: 10, opacity: 0.9 }}>419/151-A, Chinnakadai Street, Salem - 636 001.</div>
        <div style={{ fontSize: 9, opacity: 0.85 }}>(A ROSCI Institution)</div>
      </div>
      <div style={{ background: "#c8e3a4", color: "#0f2744", padding: "4px 10px", fontWeight: 700, fontSize: 11, display: "flex", justifyContent: "space-between", borderBottom: "1px solid #3f5119" }}>
        <span>Phone No: {subscriber.whatsapp_number}</span>
        <span>{subscriber.access_code}</span>
      </div>

      <div style={{ background: "#f7eecf", padding: "10px 14px", borderBottom: "1px solid #0f2744", textAlign: "center", fontSize: 11, lineHeight: 1.5 }}>
        <strong>Dear {/^(mr|ms|mrs|dr)\.?/i.test(subscriber.name) ? "" : "Mr./Ms. "}{subscriber.name},</strong><br />
        {subscriber.address_line1 || ""}{subscriber.address_line2 ? `, ${subscriber.address_line2}` : ""}<br />
        {subscriber.city || "Salem"} - {subscriber.pincode || ""}.
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#0f2744", color: "white" }}>
            <th style={{ padding: "6px", textAlign: "center", border: "1px solid #0f2744" }}>Date</th>
            <th style={{ padding: "6px", textAlign: "center", border: "1px solid #0f2744" }}>Group</th>
            <th style={{ padding: "6px", textAlign: "left", border: "1px solid #0f2744" }}>Subscriber Name</th>
            <th style={{ padding: "6px", textAlign: "center", border: "1px solid #0f2744" }}>Mode of Payment</th>
            <th style={{ padding: "6px", textAlign: "right", border: "1px solid #0f2744" }}>Chit Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: "16px", textAlign: "center", color: "#6b7280", border: "1px solid #d1d5db" }}>Select a chit group or enable "No Chit Enrolled"</td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: "6px", textAlign: "center", border: "1px solid #d1d5db" }}>{formatDateDMY(r.date)}</td>
                <td style={{ padding: "6px", textAlign: "center", border: "1px solid #d1d5db" }}>{r.group}</td>
                <td style={{ padding: "6px", border: "1px solid #d1d5db" }}>{r.name},</td>
                <td style={{ padding: "6px", textAlign: "center", border: "1px solid #d1d5db" }}>{r.mode}</td>
                <td style={{ padding: "6px", textAlign: "right", border: "1px solid #d1d5db", fontFamily: "ui-monospace, monospace" }}>{formatINR(r.amount)}</td>
              </tr>
            ))
          )}
          {showVariance && (
            <tr>
              <td colSpan={4} style={{ padding: "6px 10px", border: "1px solid #d1d5db", textAlign: "left", fontWeight: 600 }}>Excess or deficit</td>
              <td style={{ padding: "6px", textAlign: "right", border: "1px solid #d1d5db", fontFamily: "ui-monospace, monospace", color: variance > 0 ? "#15803d" : variance < 0 ? "#b91c1c" : "#374151" }}>
                {variance > 0 ? `Excess ${formatINR(variance)}` : variance < 0 ? `Deficit ${formatINR(-variance)}` : "—"}
              </td>
            </tr>
          )}
          <tr style={{ background: "#b5d88f", fontWeight: 700 }}>
            <td colSpan={4} style={{ padding: "8px", border: "1px solid #3f5119", textAlign: "left" }}>Total</td>
            <td style={{ padding: "8px", textAlign: "right", border: "1px solid #3f5119", fontFamily: "ui-monospace, monospace" }}>{formatINR(total)}</td>
          </tr>
        </tbody>
      </table>

      {paymentRef && (
        <div style={{ padding: "4px 10px", fontSize: 10, color: "#374151", borderTop: "1px solid #e5e7eb" }}>
          Ref: <strong>{paymentRef}</strong>
        </div>
      )}

      <div style={{ padding: "6px 10px", fontSize: 9, color: "#6b7280", textAlign: "center", background: "#fafafa", borderTop: "1px solid #e5e7eb" }}>
        Generated on {formatDateDMY(new Date())} · Panasuna Chits (P) Ltd · {formatMonth(month)}
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
