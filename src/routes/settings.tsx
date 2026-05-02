import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { db } from "@/lib/db-types";
import { Building2, MessageSquare, Clock, Save, TestTube2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: () => (
    <ProtectedLayout>
      <SettingsPage />
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Settings — Panasuna Chits" }] }),
});

type Tab = "company" | "whatsapp" | "scheduler";

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("company");
  const qc = useQueryClient();

  const settings = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("company_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>({});
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form, updated_at: new Date().toISOString() };
      delete payload.id;
      if (settings.data?.id) {
        const { error } = await db.from("company_settings").update(payload).eq("id", settings.data.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("company_settings").insert(payload);
        if (error) throw error;
      }
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const testWhatsApp = () => {
    if (!form.wapi_key) {
      toast.error("Enter API key first");
      return;
    }
    toast.message("Testing connection…", { description: "Mock test — real AiSensy ping not wired yet." });
    setTimeout(() => toast.success("Connection successful (mock)"), 1200);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display">Settings</h1>
        <p className="text-text-2">Company profile, WhatsApp integration, and scheduler.</p>
      </div>

      <div className="flex gap-2 border-b">
        <TabBtn active={tab === "company"} onClick={() => setTab("company")} Icon={Building2}>Company Profile</TabBtn>
        <TabBtn active={tab === "whatsapp"} onClick={() => setTab("whatsapp")} Icon={MessageSquare}>WhatsApp Integration</TabBtn>
        <TabBtn active={tab === "scheduler"} onClick={() => setTab("scheduler")} Icon={Clock}>Scheduler</TabBtn>
      </div>

      <div className="rounded-xl border bg-surface p-6 max-w-2xl">
        {settings.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {tab === "company" && (
          <div className="space-y-4">
            <Field label="Company name">
              <input className="w-full px-3 py-2 rounded border" value={form.company_name ?? ""} onChange={(e) => update("company_name", e.target.value)} />
            </Field>
            <Field label="Address">
              <textarea rows={3} className="w-full px-3 py-2 rounded border resize-none" value={form.address ?? ""} onChange={(e) => update("address", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <input className="w-full px-3 py-2 rounded border" value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
              </Field>
              <Field label="WhatsApp number">
                <input className="w-full px-3 py-2 rounded border" value={form.whatsapp_no ?? ""} onChange={(e) => update("whatsapp_no", e.target.value)} />
              </Field>
            </div>
            <Field label="Tagline">
              <input className="w-full px-3 py-2 rounded border" value={form.tagline ?? ""} onChange={(e) => update("tagline", e.target.value)} />
            </Field>
            <Field label="Logo URL (optional)">
              <input className="w-full px-3 py-2 rounded border" value={form.logo_url ?? ""} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://…/logo.png" />
            </Field>
            <Field label="Default auction time">
              <input type="time" className="w-full px-3 py-2 rounded border" value={form.auction_time ?? "10:00"} onChange={(e) => update("auction_time", e.target.value)} />
            </Field>
          </div>
        )}

        {tab === "whatsapp" && (
          <div className="space-y-4">
            <Field label="Provider">
              <select className="w-full px-3 py-2 rounded border" value={form.wapi_provider ?? "aisensy"} onChange={(e) => update("wapi_provider", e.target.value)}>
                <option value="aisensy">AiSensy</option>
                <option value="wati">Wati</option>
                <option value="meta">Meta Business (future)</option>
              </select>
            </Field>
            <Field label="API key">
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  className="flex-1 px-3 py-2 rounded border font-mono"
                  value={form.wapi_key ?? ""}
                  onChange={(e) => update("wapi_key", e.target.value)}
                  placeholder="Paste your AiSensy project API key"
                />
                <button onClick={() => setShowKey((v) => !v)} className="px-3 py-2 rounded border text-sm hover:bg-accent">{showKey ? "Hide" : "Show"}</button>
              </div>
            </Field>
            <Field label="Sender number">
              <input className="w-full px-3 py-2 rounded border" value={form.wapi_sender ?? ""} onChange={(e) => update("wapi_sender", e.target.value)} placeholder="91XXXXXXXXXX" />
            </Field>
            <button onClick={testWhatsApp} className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm hover:bg-accent">
              <TestTube2 className="h-4 w-4" /> Test connection
            </button>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <strong>Demo mode:</strong> Sending is mocked. Add your AiSensy API key here, then connect the dispatch worker to enable real WhatsApp delivery.
            </div>
          </div>
        )}

        {tab === "scheduler" && (
          <div className="space-y-4">
            <Field label="Daily send time (cron)">
              <input className="w-full px-3 py-2 rounded border font-mono" value={form.scheduler_time ?? "0 9 * * *"} onChange={(e) => update("scheduler_time", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Default: <code>0 9 * * *</code> (9:00 AM daily)</p>
            </Field>
            <Field label="Days before auction">
              <input type="number" min={0} max={30} className="w-full px-3 py-2 rounded border" value={form.days_before_auction ?? 1} onChange={(e) => update("days_before_auction", Number(e.target.value))} />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.auto_send_enabled ?? true} onChange={(e) => update("auto_send_enabled", e.target.checked)} />
              <span className="text-sm">Auto-send reminders on schedule</span>
            </label>
          </div>
        )}

        <div className="mt-6 pt-4 border-t flex justify-end">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Save className="h-4 w-4" /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, Icon, children }: { active: boolean; onClick: () => void; Icon: typeof Building2; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition " +
        (active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
