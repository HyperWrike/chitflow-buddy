import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { currentMonth, formatINR, formatMonth, monthOptions } from "@/lib/format";
import { computeGroupTotals, computeMemberDue } from "@/lib/calculator";
import { CheckCircle2, Lock, Calculator, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/data-entry")({
  component: DataEntryPage,
  head: () => ({ meta: [{ title: "Monthly Entry — Panasuna Chits" }] }),
});

function DataEntryPage() {
  return <ProtectedLayout><DataEntry /></ProtectedLayout>;
}

function DataEntry() {
  const [month, setMonth] = useState(currentMonth());
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedGroupForAdd, setSelectedGroupForAdd] = useState("");
  const months = monthOptions(24);

  const groups = useQuery({
    queryKey: ["active-groups"],
    queryFn: async () => {
      const { data, error } = await db.from("chit_groups").select("*").eq("status", "active").order("group_code");
      if (error) throw error;
      return data;
    },
  });

  const entries = useQuery({
    queryKey: ["monthly-entries", month],
    queryFn: async () => {
      const { data, error } = await db.from("monthly_entries").select("*").eq("month", month);
      if (error) throw error;
      return data;
    },
  });

  const entryByGroup = useMemo(() => {
    const m = new Map<string, any>();
    (entries.data ?? []).forEach((e) => m.set(e.group_id, e));
    return m;
  }, [entries.data]);

  const total = groups.data?.length ?? 0;
  const done = (entries.data ?? []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Monthly Data Entry</h1>
          <p className="text-sm text-muted-foreground">Enter winning bid for each group, then confirm to lock.</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Entry
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <Label>Month</Label>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={month} onChange={(e) => { setMonth(e.target.value); setActiveGroupId(null); }}>
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{done} of {total} groups entered for {formatMonth(month)}</div>
            <div className="mt-1 h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Group</th>
              <th className="px-4 py-2 text-right">Chit Value</th>
              <th className="px-4 py-2 text-left">Auction</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(groups.data ?? []).map((g) => {
              const e = entryByGroup.get(g.id);
              return (
                <tr key={g.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-medium">{g.group_code}</td>
                  <td className="px-4 py-3 text-right">{formatINR(g.chit_value)}</td>
                  <td className="px-4 py-3">Day {g.auction_day}</td>
                  <td className="px-4 py-3">
                    {e?.locked
                      ? <span className="inline-flex items-center gap-1 text-xs text-success"><Lock className="h-3 w-3" /> Locked</span>
                      : e
                        ? <span className="inline-flex items-center gap-1 text-xs text-warning-foreground bg-warning/30 rounded-full px-2 py-0.5">Draft</span>
                        : <span className="text-xs text-muted-foreground">Pending</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant={e?.locked ? "ghost" : "default"} size="sm" onClick={() => setActiveGroupId(g.id)}>
                      {e?.locked ? "View" : e ? "Continue" : "Enter Data"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {activeGroupId && (
        <EntryForm
          groupId={activeGroupId}
          month={month}
          onClose={() => setActiveGroupId(null)}
        />
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Monthly Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Chit Group</Label>
              <select
                className="w-full mt-2 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedGroupForAdd}
                onChange={(e) => setSelectedGroupForAdd(e.target.value)}
              >
                <option value="">Select a group...</option>
                {(groups.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>{g.group_code} (Day {g.auction_day})</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              This will open the data entry form for the selected group for the current selected month ({formatMonth(month)}).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!selectedGroupForAdd}
              onClick={() => {
                setActiveGroupId(selectedGroupForAdd);
                setAddDialogOpen(false);
                setSelectedGroupForAdd("");
              }}
            >
              Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntryForm({ groupId, month, onClose }: { groupId: string; month: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const group = useQuery({
    queryKey: ["group-for-entry", groupId],
    queryFn: async () => {
      const { data, error } = await db.from("chit_groups").select("*").eq("id", groupId).single();
      if (error) throw error;
      return data;
    },
  });

  const subs = useQuery({
    queryKey: ["subs-for-entry", groupId],
    queryFn: async () => {
      const { data, error } = await db
        .from("subscriptions")
        .select("*, subscribers!inner(name, access_code)")
        .eq("group_id", groupId).eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const existing = useQuery({
    queryKey: ["entry", groupId, month],
    queryFn: async () => {
      const { data, error } = await db.from("monthly_entries").select("*").eq("group_id", groupId).eq("month", month).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [winningBid, setWinningBid] = useState<string>("");
  const [commission, setCommission] = useState<string>("");
  const [prizedSubId, setPrizedSubId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);

  // hydrate from existing entry once loaded
  if (existing.data && !hydrated) {
    setWinningBid(String(existing.data.winning_bid));
    setCommission(String(existing.data.company_commission));
    setPrizedSubId(existing.data.prized_subscription_id ?? "");
    setHydrated(true);
  }

  const totalSeats = (subs.data ?? []).reduce((s, m: any) => s + m.seat_count, 0);

  const calc = useMemo(() => {
    if (!group.data || !winningBid || totalSeats === 0) return null;
    const wb = Number(winningBid);
    if (!Number.isFinite(wb) || wb <= 0) return null;
    const totals = computeGroupTotals({
      chit_value: Number(group.data.chit_value),
      duration_months: group.data.duration_months,
      winning_bid: wb,
      commission_rate: Number(group.data.commission_rate),
      total_seats_in_group: totalSeats,
    });
    return totals;
  }, [group.data, winningBid, totalSeats]);

  // auto-fill commission when calc becomes available
  if (calc && !commission) {
    // safe: setState in render with a guard avoids loops
    setCommission(String(Math.round(calc.company_commission)));
  }

  const memberRows = useMemo(() => {
    if (!calc) return [];
    return (subs.data ?? []).map((m: any) => {
      const isPrized = m.id === prizedSubId || m.prized;
      const due = computeMemberDue({
        base_installment: calc.base_installment,
        per_seat_discount: calc.per_seat_discount,
        seat_count: m.seat_count,
        prized: isPrized,
      });
      return { ...m, ...due, isPrized };
    });
  }, [subs.data, calc, prizedSubId]);

  const save = async (lock: boolean) => {
    if (!calc) { toast.error("Enter a valid winning bid first."); return; }
    if (!prizedSubId) { toast.error("Select who won the auction."); return; }
    setBusy(true);
    try {
      const entryPayload = {
        group_id: groupId,
        month,
        winning_bid: Number(winningBid),
        company_commission: Number(commission || calc.company_commission),
        prized_subscription_id: prizedSubId,
        entered_by: user?.id ?? null,
        locked: lock,
      };
      let entryId: string;
      if (existing.data) {
        const { error } = await db.from("monthly_entries").update(entryPayload).eq("id", existing.data.id);
        if (error) throw error;
        entryId = existing.data.id;
        // wipe old dues to recompute
        await db.from("member_dues").delete().eq("monthly_entry_id", entryId);
      } else {
        const { data, error } = await db.from("monthly_entries").insert(entryPayload).select("id").single();
        if (error) throw error;
        entryId = data.id;
      }

      const dueRows = memberRows.map((r) => ({
        subscription_id: r.id,
        monthly_entry_id: entryId,
        previous_bid: null,
        share_of_discount: Math.round(r.share_of_discount),
        base_installment: Math.round(calc.base_installment),
        chit_amount_due: Math.round(r.chit_amount_due),
      }));
      const { error: e2 } = await db.from("member_dues").insert(dueRows);
      if (e2) throw e2;

      // mark winner as prized
      if (lock) {
        await db.from("subscriptions").update({ prized: true, prized_month: month }).eq("id", prizedSubId);
      }

      toast.success(lock ? "Entry confirmed and locked" : "Saved as draft");
      qc.invalidateQueries({ queryKey: ["monthly-entries"] });
      qc.invalidateQueries({ queryKey: ["entry", groupId, month] });
      if (lock) onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setBusy(false); }
  };

  if (group.isLoading) return null;
  const locked = existing.data?.locked;

  return (
    <Card className="p-5 border-primary/30">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">{group.data?.group_code} — {formatMonth(month)}</h3>
          <p className="text-xs text-muted-foreground">{totalSeats} total seats · {(subs.data ?? []).length} members</p>
        </div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
        <div><Label>Winning Bid (₹) *</Label><Input type="number" disabled={locked} value={winningBid} onChange={(e) => setWinningBid(e.target.value)} placeholder="e.g. 1800000" /></div>
        <div><Label>Company Commission (₹)</Label><Input type="number" disabled={locked} value={commission} onChange={(e) => setCommission(e.target.value)} placeholder={calc ? String(Math.round(calc.company_commission)) : ""} /></div>
        <div>
          <Label>Who Won the Auction *</Label>
          <select disabled={locked} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={prizedSubId} onChange={(e) => setPrizedSubId(e.target.value)}>
            <option value="">Choose winner...</option>
            {(subs.data ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>{s.subscribers.access_code} — {s.name_on_chit}</option>
            ))}
          </select>
        </div>
      </div>

      {calc && (
        <Card className="p-4 mb-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-2"><Calculator className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Calculation</span></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div><div className="text-muted-foreground">Base Installment</div><div className="font-semibold">{formatINR(calc.base_installment)}</div></div>
            <div><div className="text-muted-foreground">Total Discount</div><div className="font-semibold">{formatINR(calc.total_discount)}</div></div>
            <div><div className="text-muted-foreground">Company Commission</div><div className="font-semibold">{formatINR(calc.company_commission)}</div></div>
            <div><div className="text-muted-foreground">Net Discount</div><div className="font-semibold">{formatINR(calc.net_discount)}</div></div>
            <div><div className="text-muted-foreground">Per-Seat Discount</div><div className="font-semibold">{formatINR(calc.per_seat_discount)}</div></div>
          </div>
        </Card>
      )}

      {memberRows.length > 0 && (
        <div className="overflow-x-auto rounded-md border mb-4">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Member</th><th className="px-3 py-2 text-right">Seats</th><th className="px-3 py-2 text-left">Prized</th><th className="px-3 py-2 text-right">Discount Share</th><th className="px-3 py-2 text-right">Amount Due</th></tr>
            </thead>
            <tbody className="divide-y">
              {memberRows.map((r) => (
                <tr key={r.id} className={r.isPrized ? "bg-gold/10" : ""}>
                  <td className="px-3 py-2"><div className="font-medium">{r.name_on_chit}</div><div className="text-[10px] font-mono text-muted-foreground">{r.subscribers.access_code}</div></td>
                  <td className="px-3 py-2 text-right">{r.seat_count}</td>
                  <td className="px-3 py-2">{r.isPrized ? <span className="text-xs font-semibold text-gold-foreground">Yes</span> : <span className="text-xs text-muted-foreground">No</span>}</td>
                  <td className="px-3 py-2 text-right">{r.isPrized ? "—" : formatINR(r.share_of_discount)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatINR(r.chit_amount_due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!locked && (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={busy} onClick={() => save(false)}>Save Draft</Button>
          <Button disabled={busy} onClick={() => save(true)}><CheckCircle2 className="mr-2 h-4 w-4" /> Confirm & Lock</Button>
        </div>
      )}
      {locked && (
        <div className="text-sm text-success flex items-center gap-2"><Lock className="h-4 w-4" /> This entry is locked. Statements can be sent from the Dispatch screen.</div>
      )}
    </Card>
  );
}
