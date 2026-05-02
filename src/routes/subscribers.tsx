import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type Subscriber } from "@/lib/db-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Plus, Search, Pencil, Trash } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

import Papa from 'papaparse';
import { downloadCSV } from "@/lib/export";
import { Upload, Download } from "lucide-react";

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

function Subscribers() {
  const [search, setSearch] = useState("");
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["subscribers"],
    queryFn: async () => {
      const { data, error } = await db.from("subscribers").select("*").order("name");
      if (error) throw error;
      return data as Subscriber[];
    },
  });

  const handleExport = () => {
    if (!list.data) return;
    const exportData = list.data.map(s => ({
      Code: s.access_code,
      Name: s.name,
      WhatsApp: s.whatsapp_number,
      AltPhone: s.alt_number || '',
      Address1: s.address_line1 || '',
      Address2: s.address_line2 || '',
      City: s.city || '',
      Pincode: s.pincode || '',
      Active: s.active ? 'Yes' : 'No'
    }));
    downloadCSV(exportData, 'subscribers.csv');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        toast.info(`Importing ${rows.length} subscribers...`);
        let imported = 0;
        for (const row of rows) {
          try {
            if (!row.Name || !row.WhatsApp) continue;
            const payload = {
              access_code: row.Code || `IMP${Math.floor(Math.random() * 10000)}`,
              name: row.Name,
              whatsapp_number: String(row.WhatsApp).replace(/\D/g, "").slice(-10),
              alt_number: row.AltPhone || null,
              address_line1: row.Address1 || null,
              address_line2: row.Address2 || null,
              city: row.City || "Unknown",
              pincode: row.Pincode || null,
              active: row.Active?.toLowerCase() !== 'no'
            };
            await db.from("subscribers").insert(payload);
            imported++;
          } catch (err) {
            console.error(err);
          }
        }
        toast.success(`Successfully imported ${imported} subscribers`);
        qc.invalidateQueries({ queryKey: ["subscribers"] });
      }
    });
  };

  const filtered = (list.data ?? []).filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.access_code.toLowerCase().includes(q) ||
      s.whatsapp_number.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscribers</h1>
          <p className="text-sm text-muted-foreground">{list.data?.length ?? 0} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <div>
              <input type="file" accept=".csv" id="import-csv" className="hidden" onChange={handleImport} />
              <Button variant="outline" asChild>
                <label htmlFor="import-csv" className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" /> Import CSV
                </label>
              </Button>
            </div>
            <Button variant="destructive" onClick={async () => {
              if (!confirm('Delete ALL subscribers? This cannot be undone.')) return;
              try {
                const ids = (list.data ?? []).map(s => s.id);
                if (ids.length === 0) { toast.info('No subscribers to delete'); return; }
                await db.from('subscribers').delete().in('id', ids);
                qc.invalidateQueries({ queryKey: ['subscribers'] });
                toast.success(`Deleted ${ids.length} subscriber(s)`);
              } catch (err: any) {
                console.error(err);
                toast.error('Failed to delete subscribers');
              }
            }}>
              <Trash className="mr-2 h-4 w-4" /> Delete All
            </Button>
          </div>
          <SubscriberDialog />
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, code, or phone..."
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
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">WhatsApp</th>
                <th className="px-4 py-3 text-left">City</th>
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
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{s.access_code}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link to="/subscribers/$id" params={{ id: s.id }} className="hover:text-primary hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.whatsapp_number}</td>
                  <td className="px-4 py-3">{s.city}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <SubscriberDialog existing={s} />
                      <Button variant="ghost" size="sm" onClick={async () => {
                        if (!confirm(`Delete subscriber ${s.name}? This cannot be undone.`)) return;
                        try {
                          const { error } = await db.from('subscribers').delete().eq('id', s.id);
                          if (error) throw error;
                          qc.invalidateQueries({ queryKey: ['subscribers'] });
                          toast.success('Subscriber deleted');
                        } catch (err: any) {
                          console.error(err);
                          toast.error('Failed to delete');
                        }
                      }}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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
        const { error } = await db.from("subscribers").update(payload).eq("id", existing.id);
        if (error) throw error;
        toast.success("Subscriber updated");
      } else {
        const { error } = await db.from("subscribers").insert(payload);
        if (error) throw error;
        toast.success("Subscriber added");
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
          <DialogFooter>
            <Button type="submit" disabled={busy}>{existing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
