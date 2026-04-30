import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type ChitGroup } from "@/lib/db-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Plus, Search, Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
  head: () => ({ meta: [{ title: "Chit Groups — Panasuna Chits" }] }),
});

function GroupsPage() {
  return (
    <ProtectedLayout><Groups /></ProtectedLayout>
  );
}

function Groups() {
  const [search, setSearch] = useState("");
  const { isAdmin } = useAuth();

  const list = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await db.from("chit_groups").select("*").order("group_code");
      if (error) throw error;
      return data as ChitGroup[];
    },
  });

  const filtered = (list.data ?? []).filter(
    (g) => !search || g.group_code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Chit Groups</h1>
          <p className="text-sm text-muted-foreground">{list.data?.length ?? 0} groups</p>
        </div>
        <GroupDialog />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by group code..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Agreement</th>
                <th className="px-4 py-3 text-right">Chit Value</th>
                <th className="px-4 py-3 text-right">Months</th>
                <th className="px-4 py-3 text-left">Auction</th>
                <th className="px-4 py-3 text-right">Comm.</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!list.isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No groups found.</td></tr>
              )}
              {filtered.map((g) => (
                <tr key={g.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-medium">
                    <Link to="/groups/$id" params={{ id: g.id }} className="hover:text-primary hover:underline">{g.group_code}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{g.agreement_no ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{formatINR(g.chit_value)}</td>
                  <td className="px-4 py-3 text-right">{g.duration_months}</td>
                  <td className="px-4 py-3">Day {g.auction_day}{g.auction_time ? ` · ${g.auction_time}` : ""}</td>
                  <td className="px-4 py-3 text-right">{g.commission_rate}%</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${g.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{g.status}</span></td>
                  <td className="px-4 py-3 text-right"><GroupDialog existing={g} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function GroupDialog({ existing }: { existing?: ChitGroup }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<ChitGroup>>(
    existing ?? { commission_rate: 5, status: "active", auction_time: "5:00 PM" },
  );

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        group_code: form.group_code!.trim(),
        agreement_no: form.agreement_no ?? null,
        chit_value: Number(form.chit_value),
        duration_months: Number(form.duration_months),
        auction_day: Number(form.auction_day),
        auction_time: form.auction_time ?? null,
        commission_rate: Number(form.commission_rate ?? 5),
        start_month: form.start_month ?? null,
        status: form.status ?? "active",
      };
      if (existing) {
        const { error } = await db.from("chit_groups").update(payload).eq("id", existing.id);
        if (error) throw error;
        toast.success("Group updated");
      } else {
        const { error } = await db.from("chit_groups").insert(payload);
        if (error) throw error;
        toast.success("Group added");
      }
      qc.invalidateQueries({ queryKey: ["groups"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="sm"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button><Plus className="mr-2 h-4 w-4" /> Add Group</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{existing ? "Edit Group" : "Add Chit Group"}</DialogTitle></DialogHeader>
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Group Code *</Label><Input required value={form.group_code ?? ""} onChange={(e) => setForm({ ...form, group_code: e.target.value })} placeholder="PS159" /></div>
            <div><Label>Agreement #</Label><Input value={form.agreement_no ?? ""} onChange={(e) => setForm({ ...form, agreement_no: e.target.value })} placeholder="135/20" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Chit Value *</Label><Input required type="number" value={form.chit_value ?? ""} onChange={(e) => setForm({ ...form, chit_value: Number(e.target.value) })} placeholder="3000000" /></div>
            <div><Label>Duration (months) *</Label><Input required type="number" value={form.duration_months ?? ""} onChange={(e) => setForm({ ...form, duration_months: Number(e.target.value) })} placeholder="60" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Auction Day *</Label><Input required type="number" min={1} max={31} value={form.auction_day ?? ""} onChange={(e) => setForm({ ...form, auction_day: Number(e.target.value) })} /></div>
            <div><Label>Auction Time</Label><Input value={form.auction_time ?? ""} onChange={(e) => setForm({ ...form, auction_time: e.target.value })} placeholder="5:00 PM" /></div>
            <div><Label>Commission %</Label><Input type="number" step="0.1" value={form.commission_rate ?? 5} onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Month (YYYY-MM)</Label><Input value={form.start_month ?? ""} onChange={(e) => setForm({ ...form, start_month: e.target.value })} placeholder="2020-01" /></div>
            <div><Label>Status</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status ?? "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <DialogFooter><Button type="submit" disabled={busy}>{existing ? "Save" : "Add"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
