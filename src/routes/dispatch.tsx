import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { currentMonth, formatINR, formatMonth, monthOptions } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatementNotice } from "@/components/StatementNotice";
import { Eye, Send, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/dispatch")({
  component: DispatchPage,
  head: () => ({ meta: [{ title: "Dispatch — Panasuna Chits" }] }),
});

function DispatchPage() {
  return <ProtectedLayout><Dispatch /></ProtectedLayout>;
}

function Dispatch() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<string>("all");
  const months = monthOptions(24);

  // Build per-subscriber statement summary for the chosen month
  const summary = useQuery({
    queryKey: ["dispatch-summary", month],
    queryFn: async () => {
      const { data: dues, error } = await db
        .from("member_dues")
        .select(`
          chit_amount_due,
          subscriptions!inner(subscriber_id, name_on_chit, prized,
            subscribers!inner(id, name, access_code, whatsapp_number, address_line1, address_line2, city, pincode),
            chit_groups!inner(group_code, chit_value, auction_day, auction_time)),
          monthly_entries!inner(month)
        `)
        .eq("monthly_entries.month", month);
      if (error) throw error;

      const bySub = new Map<string, any>();
      (dues ?? []).forEach((d: any) => {
        const sub = d.subscriptions.subscribers;
        if (!bySub.has(sub.id)) bySub.set(sub.id, { subscriber: sub, rows: [], total: 0 });
        const entry = bySub.get(sub.id);
        entry.rows.push({
          auction_day: d.subscriptions.chit_groups.auction_day,
          auction_time: d.subscriptions.chit_groups.auction_time,
          group_code: d.subscriptions.chit_groups.group_code,
          name_on_chit: d.subscriptions.name_on_chit,
          prized: d.subscriptions.prized,
          chit_value: Number(d.subscriptions.chit_groups.chit_value),
          amount_due: Number(d.chit_amount_due),
        });
        entry.total += Number(d.chit_amount_due);
      });

      const { data: logs } = await db.from("dispatch_log").select("*").eq("month", month);
      const logBySub = new Map<string, any>();
      (logs ?? []).forEach((l) => logBySub.set(l.subscriber_id, l));

      return Array.from(bySub.values()).map((e) => ({
        ...e,
        log: logBySub.get(e.subscriber.id) ?? null,
      }));
    },
  });

  const filtered = useMemo(() => {
    const data = summary.data ?? [];
    if (filter === "all") return data;
    if (filter === "pending") return data.filter((s) => !s.log || s.log.status === "pending");
    if (filter === "sent") return data.filter((s) => s.log?.status === "sent");
    if (filter === "failed") return data.filter((s) => s.log?.status === "failed");
    return data;
  }, [summary.data, filter]);

  const sendOne = async (sub: any) => {
    // Stubbed sender: marks dispatch_log as "sent". Replace with real WhatsApp API call later.
    const payload = {
      subscriber_id: sub.subscriber.id,
      month,
      whatsapp_number: sub.subscriber.whatsapp_number,
      status: "sent",
      sent_at: new Date().toISOString(),
      attempt_count: (sub.log?.attempt_count ?? 0) + 1,
      last_error: null as string | null,
    };
    if (sub.log) {
      const { error } = await db.from("dispatch_log").update(payload).eq("id", sub.log.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await db.from("dispatch_log").insert(payload);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["dispatch-summary", month] });
  };

  const sendAll = async () => {
    if (!confirm(`Send statements to ${filtered.length} subscriber(s) for ${formatMonth(month)}?`)) return;
    let ok = 0;
    for (const s of filtered) {
      if (s.log?.status === "sent") continue;
      await sendOne(s); ok++;
    }
    toast.success(`Marked ${ok} as sent. Connect a WhatsApp BSP later to actually deliver.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dispatch & Reports</h1>
          <p className="text-sm text-muted-foreground">
            WhatsApp BSP not yet connected — sends are simulated for now.
          </p>
        </div>
        <Button onClick={sendAll}><Send className="mr-2 h-4 w-4" /> Send All Pending</Button>
      </div>

      <Card className="p-5">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <Label>Month</Label>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">{filtered.length} records</div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Subscriber</th>
              <th className="px-4 py-2 text-right">Groups</th>
              <th className="px-4 py-2 text-right">Total Due</th>
              <th className="px-4 py-2 text-left">WhatsApp</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {summary.isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
            {!summary.isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No statements available. Enter monthly data first.</td></tr>
            )}
            {filtered.map((s) => {
              const status = s.log?.status ?? "pending";
              const color = status === "sent" ? "bg-success/15 text-success" : status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";
              return (
                <tr key={s.subscriber.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.subscriber.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{s.subscriber.access_code}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{s.rows.length}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatINR(s.total)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.subscriber.whatsapp_number}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>{status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <PreviewDialog summary={s} month={month} />
                      <Button size="sm" variant={status === "sent" ? "ghost" : "default"} onClick={() => sendOne(s)}>
                        {status === "failed" ? <><RotateCcw className="mr-1 h-3 w-3" /> Resend</> : <><Send className="mr-1 h-3 w-3" /> Send</>}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PreviewDialog({ summary, month }: { summary: any; month: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Eye className="h-3 w-3" /></Button></DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Statement Preview</DialogTitle></DialogHeader>
        <div className="overflow-auto p-2">
          <StatementNotice
            subscriber={summary.subscriber}
            month={month}
            rows={summary.rows}
            auctionTime={summary.rows[0]?.auction_time}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
