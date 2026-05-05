import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type Subscriber } from "@/lib/db-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";
import { Plus, Search, Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  addDemoSubscription,
  deleteDemoSubscriber,
  ensureDemoState,
  getDemoGroups,
  getDemoSubscriberPayload,
  peekNextAccessCode,
  saveDemoSubscriber,
} from "@/lib/demo-data";
import type { ChitGroup } from "@/lib/db-types";
import { useDemoSync } from "@/lib/use-demo-sync";

export const Route = createFileRoute("/subscribers")({
  component: SubscribersPage,
  head: () => ({ meta: [{ title: "Subscribers — Panasuna Chits" }] }),
});

function SubscribersPage() {
  return (
    <ProtectedLayout>
      <Subscribers />
    </ProtectedLayout>
  );
}

const PAGE_SIZE = 50;

function Subscribers() {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  React.useEffect(() => { setPage(1); }, [search, groupFilter, statusFilter]);

  useDemoSync([["subscribers"]]);

  // Subscribe to real-time changes
  React.useEffect(() => {
    ensureDemoState();
    const channel = db.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscribers' },
        () => qc.invalidateQueries({ queryKey: ['subscribers'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions' },
        () => qc.invalidateQueries({ queryKey: ['subscribers'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chit_groups' },
        () => qc.invalidateQueries({ queryKey: ['subscribers'] })
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [qc]);

  const list = useQuery({
    queryKey: ["subscribers"],
    queryFn: async () => {
      const { data, error } = await db
        .from("subscribers")
        .select("*, subscriptions(id, chit_groups(group_code))")
        .order("name");
      if (error || !data?.length) {
        return getDemoSubscriberPayload();
      }
      return data as (Subscriber & { subscriptions: { id: string, chit_groups: { group_code: string } }[] })[];
    },
  });

  const allRows = list.data ?? [];
  const groupOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of allRows) {
      for (const sub of s.subscriptions ?? []) {
        if (sub.chit_groups?.group_code) set.add(sub.chit_groups.group_code);
      }
    }
    return Array.from(set).sort();
  }, [allRows]);

  const filtered = allRows.filter((s) => {
    if (statusFilter === "active" && !s.active) return false;
    if (statusFilter === "inactive" && s.active) return false;
    if (groupFilter) {
      const codes = (s.subscriptions ?? []).map((x) => x.chit_groups?.group_code);
      if (!codes.includes(groupFilter)) return false;
    }
    const q = search.toLowerCase().trim();
    return (
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.access_code.toLowerCase().includes(q) ||
      s.whatsapp_number.includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscribers</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length === allRows.length
              ? `${allRows.length} total`
              : `${filtered.length} of ${allRows.length} matching`}
          </p>
        </div>
        <SubscriberDialog />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, or phone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="">All groups</option>
          {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
        >
          <option value="all">All status</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        {(search || groupFilter || statusFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setGroupFilter(""); setStatusFilter("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      {!list.isLoading && (list.data?.length ?? 0) === 0 && (
        <Card className="border-dashed border-muted-foreground/30 bg-muted/20 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">No subscriber data yet</div>
              <p className="text-sm text-muted-foreground">
                The database is empty right now. Open ChitSync inside the app to load sample people and test the workflow.
              </p>
            </div>
            <Button asChild>
              <Link to="/chitsync">Open ChitSync</Link>
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">WhatsApp</th>
                <th className="px-4 py-3 text-left">Groups</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {!list.isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No subscribers found.</td></tr>
              )}
              {visible.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{s.access_code}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link to="/subscribers/$id" params={{ id: s.id }} className="hover:text-primary hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.whatsapp_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.subscriptions?.map(sub => (
                         <span key={sub.id} className="rounded-full bg-muted/60 px-2 py-0.5 text-xs">
                           {sub.chit_groups.group_code}
                         </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <SubscriberDialog existing={s} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
                          try {
                            const { error } = await db.from("subscribers").delete().eq("id", s.id);
                            if (!error) await db.from("subscriptions").delete().eq("subscriber_id", s.id);
                            // Always cascade to demo state (it's the source of truth when DB is empty/RLS-blocked).
                            deleteDemoSubscriber(s.id);
                            qc.invalidateQueries({ queryKey: ["subscribers"] });
                            toast.success("Subscriber deleted");
                          } catch (err) {
                            console.error(err);
                            toast.error("Failed to delete subscriber");
                          }
                        }}
                      >
                        <span className="text-destructive">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <div>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <span>Page {safePage} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <Outlet />
    </div>
  );
}

function SubscriberDialog({ existing }: { existing?: Subscriber }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<Subscriber>>(
    existing ?? { city: "Salem", active: true },
  );
  const [groupIds, setGroupIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (open && !existing && !form.access_code) {
      setForm((prev) => ({ ...prev, access_code: peekNextAccessCode() }));
    }
  }, [open, existing, form.access_code]);

  const groupsQ = useQuery({
    queryKey: ["all-groups-for-subscriber-create"],
    queryFn: async () => {
      const { data } = await db.from("chit_groups").select("id, group_code, agreement_no, chit_value, duration_months, auction_day, auction_time, commission_rate, start_month, status").eq("status", "active").order("group_code");
      if (!data?.length) return getDemoGroups().filter((g) => g.status === "active");
      return data as ChitGroup[];
    },
    enabled: open && !existing,
  });

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        access_code: form.access_code!.trim(),
        name: form.name!.trim(),
        address_line1: form.address_line1 ?? null,
        address_line2: form.address_line2 ?? null,
        city: (form.city ?? "Salem").trim(),
        pincode: form.pincode ?? null,
        whatsapp_number: form.whatsapp_number!.replace(/\D/g, "").slice(-10),
        alt_number: form.alt_number ?? null,
        active: form.active ?? true,
      };
      if (existing) {
        await db.from("subscribers").update(payload).eq("id", existing.id);
        saveDemoSubscriber(payload, existing.id);
        toast.success("Subscriber updated");
      } else {
        await db.from("subscribers").insert(payload);
        const created = saveDemoSubscriber(payload);
        if (groupIds.length) {
          for (const gid of groupIds) {
            await db.from("subscriptions").insert({
              subscriber_id: created.id, group_id: gid,
              name_on_chit: created.name, seat_count: 1,
            });
            addDemoSubscription({
              subscriber_id: created.id, group_id: gid,
              name_on_chit: created.name, seat_count: 1,
            });
          }
        }
        toast.success(
          `Added ${created.name} (${created.access_code})${groupIds.length ? ` · enrolled in ${groupIds.length} group${groupIds.length === 1 ? "" : "s"}` : ""}`,
        );
        setGroupIds([]);
      }
      qc.invalidateQueries({ queryKey: ["subscribers"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="sm"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button><Plus className="mr-2 h-4 w-4" /> Add Subscriber</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Subscriber" : "Add Subscriber"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Access Code *</Label>
              <Input required value={form.access_code ?? ""} onChange={(e) => setForm({ ...form, access_code: e.target.value })} placeholder="PCPL0031" />
              {!existing && <p className="mt-1 text-[10px] text-muted-foreground">Auto-generated. Edit if you need a custom code.</p>}
            </div>
            <div>
              <Label>WhatsApp # *</Label>
              <Input required value={form.whatsapp_number ?? ""} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="9842567890" />
            </div>
          </div>
          <div>
            <Label>Full Name *</Label>
            <Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Address Line 1</Label>
            <Input value={form.address_line1 ?? ""} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
          </div>
          <div>
            <Label>Address Line 2</Label>
            <Input value={form.address_line2 ?? ""} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>City</Label>
              <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Pincode</Label>
              <Input value={form.pincode ?? ""} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            </div>
            <div>
              <Label>Alt Phone</Label>
              <Input value={form.alt_number ?? ""} onChange={(e) => setForm({ ...form, alt_number: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.active ?? true} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            <Label>Active</Label>
          </div>
          {!existing && (
            <div>
              <Label>Enroll in Chit Groups</Label>
              <p className="mb-1 text-xs text-muted-foreground">Optional — pick the groups this subscriber should be enrolled in right away.</p>
              <div className="max-h-44 overflow-y-auto rounded-md border bg-background p-2 text-sm">
                {(groupsQ.data ?? []).length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No active groups available.</p>}
                {(groupsQ.data ?? []).map((g) => (
                  <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(g.id)}
                      onChange={() =>
                        setGroupIds((prev) => (prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]))
                      }
                    />
                    <span className="font-mono text-xs text-muted-foreground">{g.group_code}</span>
                    <span className="truncate">{g.agreement_no ?? ""}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{g.chit_value.toLocaleString("en-IN")} · {g.duration_months}m</span>
                  </label>
                ))}
              </div>
              {groupIds.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{groupIds.length} group{groupIds.length === 1 ? "" : "s"} selected.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy}>{existing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
