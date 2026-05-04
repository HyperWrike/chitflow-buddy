import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/groups/$id")({
  component: GroupDetailPage,
  head: () => ({ meta: [{ title: "Group Details — Panasuna Chits" }] }),
});

function GroupDetailPage() {
  return <ProtectedLayout><Detail /></ProtectedLayout>;
}

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  // Subscribe to real-time changes
  React.useEffect(() => {
    const channel = db.channel(`group-changes-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `group_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["group-members", id] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chit_groups', filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["group", id] })
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [qc, id]);

  const grp = useQuery({
    queryKey: ["group", id],
    queryFn: async () => {
      const { data, error } = await db.from("chit_groups").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const members = useQuery({
    queryKey: ["group-members", id],
    queryFn: async () => {
      const { data, error } = await db
        .from("subscriptions")
        .select("*, subscribers!inner(name, access_code, whatsapp_number)")
        .eq("group_id", id);
      if (error) throw error;
      return data;
    },
  });

  const remove = async (subId: string) => {
    if (!confirm("Remove this member from the group?")) return;
    const { error } = await db.from("subscriptions").delete().eq("id", subId);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["group-members", id] }); }
  };

  if (grp.isLoading) return <div>Loading...</div>;
  if (!grp.data) return <div>Not found.</div>;

  const totalSeats = (members.data ?? []).reduce((s, m: any) => s + m.seat_count, 0);

  return (
    <div className="space-y-6">
      <Link to="/groups" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to groups
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono">{grp.data.group_code}</h1>
          <p className="text-sm text-muted-foreground">Agreement {grp.data.agreement_no ?? "—"}</p>
        </div>
        <AddMemberDialog groupId={id} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Chit Value</div><div className="text-lg font-bold">{formatINR(grp.data.chit_value)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Duration</div><div className="text-lg font-bold">{grp.data.duration_months} months</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Auction</div><div className="text-lg font-bold">Day {grp.data.auction_day}</div><div className="text-xs">{grp.data.auction_time}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total Seats</div><div className="text-lg font-bold">{totalSeats}</div></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-5 py-3">
          <h2 className="text-base font-semibold">Members ({members.data?.length ?? 0})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Subscriber</th>
              <th className="px-4 py-2 text-left">Name on Chit</th>
              <th className="px-4 py-2 text-right">Seats</th>
              <th className="px-4 py-2 text-left">Prized</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(members.data ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No members yet.</td></tr>
            )}
            {(members.data ?? []).map((m: any) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-mono text-xs">{m.subscribers.access_code}</td>
                <td className="px-4 py-3 font-medium">
                  <Link to="/subscribers/$id" params={{ id: m.subscriber_id }} className="hover:text-primary hover:underline">
                    {m.subscribers.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{m.name_on_chit}</td>
                <td className="px-4 py-3 text-right">{m.seat_count}</td>
                <td className="px-4 py-3">
                  {m.prized ? <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-foreground">Prized {m.prized_month ?? ""}</span> : <span className="text-xs text-muted-foreground">No</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AddMemberDialog({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subscriberId, setSubscriberId] = useState("");
  const [nameOnChit, setNameOnChit] = useState("");
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState(false);

  const subs = useQuery({
    queryKey: ["all-subscribers"],
    queryFn: async () => {
      const { data, error } = await db.from("subscribers").select("id, name, access_code").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await db.from("subscriptions").insert({
        subscriber_id: subscriberId, group_id: groupId,
        name_on_chit: nameOnChit, seat_count: seats,
      });
      if (error) throw error;
      toast.success("Member added");
      qc.invalidateQueries({ queryKey: ["group-members", groupId] });
      setOpen(false);
      setSubscriberId(""); setNameOnChit(""); setSeats(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Member</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Member to Group</DialogTitle></DialogHeader>
        <form onSubmit={onSave} className="space-y-3">
          <div>
            <Label>Subscriber *</Label>
            <select required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={subscriberId} onChange={(e) => {
              setSubscriberId(e.target.value);
              const s = subs.data?.find((x) => x.id === e.target.value);
              if (s && !nameOnChit) setNameOnChit(s.name);
            }}>
              <option value="">Choose subscriber...</option>
              {subs.data?.map((s) => <option key={s.id} value={s.id}>{s.access_code} — {s.name}</option>)}
            </select>
          </div>
          <div><Label>Name on Chit *</Label><Input required value={nameOnChit} onChange={(e) => setNameOnChit(e.target.value)} /></div>
          <div><Label>Seats</Label><Input type="number" min={1} value={seats} onChange={(e) => setSeats(Number(e.target.value))} /></div>
          <DialogFooter><Button type="submit" disabled={busy}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
