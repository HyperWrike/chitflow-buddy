import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/db-types";
import { Bell, Gift, Receipt, Send, Trash2, Image as ImageIcon, Calendar } from "lucide-react";
import { formatDateDMY } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/communications/offers")({
  component: () => (
    <ProtectedLayout>
      <OffersPage />
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Offers — Panasuna Chits" }] }),
});

const MAX_MSG = 250;

function OffersPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Dear {{Name}}, exciting news from Panasuna Chits!");
  const [imageUrl, setImageUrl] = useState("");
  const [audience, setAudience] = useState<"ALL" | "ACTIVE_WHATSAPP">("ALL");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);

  const campaigns = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await db
        .from("campaigns")
        .select("id, name, message, image_url, audience, status, total_sent, total_read, scheduled_at, sent_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const subCount = useQuery({
    queryKey: ["sub-count-offers"],
    queryFn: async () => {
      const { count } = await db.from("subscribers").select("id", { count: "exact", head: true }).eq("active", true);
      return count ?? 0;
    },
  });

  const insertVar = (v: string) => setMessage((m) => m + ` {{${v}}}`);

  const reset = () => {
    setName(""); setMessage("Dear {{Name}}, exciting news from Panasuna Chits!"); setImageUrl(""); setScheduledAt(""); setAudience("ALL");
  };

  const send = async (mode: "now" | "schedule") => {
    if (!name.trim() || !message.trim()) {
      toast.error("Name and message are required");
      return;
    }
    if (mode === "schedule" && !scheduledAt) {
      toast.error("Pick a schedule time");
      return;
    }
    setBusy(true);
    try {
      const { data: created, error } = await db.from("campaigns").insert({
        name: name.trim(),
        message: message.trim(),
        image_url: imageUrl || null,
        audience,
        status: mode === "now" ? "sent" : "scheduled",
        scheduled_at: mode === "schedule" ? new Date(scheduledAt).toISOString() : null,
        sent_at: mode === "now" ? new Date().toISOString() : null,
        total_sent: mode === "now" ? (subCount.data ?? 0) : 0,
      }).select().single();
      if (error) throw error;

      if (mode === "now" && created) {
        const { data: subs } = await db.from("subscribers").select("id, whatsapp_number").eq("active", true).limit(50);
        if (subs && subs.length > 0) {
          await db.from("dispatch_log").insert(
            subs.map((s: any) => ({
              subscriber_id: s.id,
              type: "offer",
              month: new Date().toISOString().slice(0, 7),
              whatsapp_number: s.whatsapp_number,
              status: "sent",
              sent_at: new Date().toISOString(),
              campaign_id: created.id,
            })),
          );
        }
        toast.success(`Campaign sent to ${subs?.length ?? 0} subscribers`);
      } else {
        toast.success(`Campaign scheduled for ${formatDateDMY(scheduledAt)}`);
      }

      qc.invalidateQueries({ queryKey: ["campaigns"] });
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    const { error } = await db.from("campaigns").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Campaign deleted");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display">Offers</h1>
        <p className="text-text-2">Bulk WhatsApp campaigns: image + message + audience + timing.</p>
      </div>
      <Tabs active="offers" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border bg-surface p-4 space-y-4">
            <div>
              <label className="text-xs font-medium">Campaign name</label>
              <input className="w-full mt-1 px-3 py-2 rounded border" placeholder="June bonus offer" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Image <span className="text-muted-foreground">(optional · jpg/png/webp · max 5MB)</span></label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  id="offer-image-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                      toast.error("Only JPG, PNG, or WEBP allowed");
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Image must be under 5MB");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setImageUrl(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                <label
                  htmlFor="offer-image-upload"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <ImageIcon className="h-4 w-4" />
                  {imageUrl ? "Replace image" : "Upload image"}
                </label>
                {imageUrl && (
                  <>
                    <img src={imageUrl} alt="" className="h-12 w-12 rounded border object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="text-xs text-red-600 underline"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium">Message</label>
                <span className={"text-xs " + (message.length > MAX_MSG ? "text-red-600" : "text-muted-foreground")}>{message.length}/{MAX_MSG}</span>
              </div>
              <textarea
                rows={5}
                className="w-full mt-1 px-3 py-2 rounded border resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_MSG}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {["Name", "Code", "Phone"].map((v) => (
                  <button key={v} onClick={() => insertVar(v)} className="text-xs px-2 py-1 rounded border bg-accent hover:bg-muted">
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Audience</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label className={"flex items-center gap-2 px-3 py-2 border rounded cursor-pointer " + (audience === "ALL" ? "bg-accent border-primary" : "")}>
                  <input type="radio" checked={audience === "ALL"} onChange={() => setAudience("ALL")} />
                  <span className="text-sm">All subscribers</span>
                </label>
                <label className={"flex items-center gap-2 px-3 py-2 border rounded cursor-pointer " + (audience === "ACTIVE_WHATSAPP" ? "bg-accent border-primary" : "")}>
                  <input type="radio" checked={audience === "ACTIVE_WHATSAPP"} onChange={() => setAudience("ACTIVE_WHATSAPP")} />
                  <span className="text-sm">Active on WhatsApp</span>
                </label>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Approx. {subCount.data ?? 0} recipients</div>
            </div>
            <div>
              <label className="text-xs font-medium">Schedule for later <span className="text-muted-foreground">(optional)</span></label>
              <input type="datetime-local" className="w-full mt-1 px-3 py-2 rounded border" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <button disabled={busy} onClick={() => send("now")} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                <Send className="h-4 w-4" /> Send now
              </button>
              <button disabled={busy || !scheduledAt} onClick={() => send("schedule")} className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-50">
                <Calendar className="h-4 w-4" /> Schedule
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-2">WhatsApp preview</div>
          <div className="bg-[#0d1418] rounded-xl overflow-hidden shadow-md max-w-sm">
            <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">P</div>
              <div>
                <div className="text-sm font-semibold">Panasuna Chits</div>
                <div className="text-xs text-white/70">online</div>
              </div>
            </div>
            <div className="p-4 min-h-[300px]" style={{ background: "#0d1418" }}>
              <div className="bg-[#005c4b] text-white rounded-lg p-2 max-w-[260px] ml-auto shadow">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full rounded mb-2 max-h-40 object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                ) : (
                  <div className="bg-white/10 rounded mb-2 p-6 text-center text-xs text-white/60"><ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-60" />image preview</div>
                )}
                <div className="text-sm whitespace-pre-wrap">
                  {message.replaceAll("{{Name}}", "Mrs. Bhuvaneswari").replaceAll("{{Code}}", "PCPL0031").replaceAll("{{Phone}}", "9842567890")}
                </div>
                <div className="text-[10px] text-white/60 text-right mt-1">12:00 ✓✓</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">Campaign history</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Audience</th>
              <th className="text-right px-4 py-2">Sent</th>
              <th className="text-right px-4 py-2">Read</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">When</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(campaigns.data ?? []).map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2">{c.audience}</td>
                <td className="px-4 py-2 text-right font-mono">{c.total_sent ?? 0}</td>
                <td className="px-4 py-2 text-right font-mono">{c.total_read ?? 0}</td>
                <td className="px-4 py-2"><StatusBadge s={c.status} /></td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{formatDateDMY(c.sent_at ?? c.scheduled_at ?? c.created_at)}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {!campaigns.isLoading && (campaigns.data ?? []).length === 0 && (
              <tr><td colSpan={7} className="text-center px-4 py-8 text-muted-foreground">No campaigns yet — create your first offer above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const styles: Record<string, string> = {
    sent: "bg-green-100 text-green-800",
    scheduled: "bg-blue-100 text-blue-800",
    draft: "bg-gray-100 text-gray-800",
    failed: "bg-red-100 text-red-800",
  };
  return <span className={"text-xs px-2 py-0.5 rounded font-medium " + (styles[s] ?? "bg-gray-100")}>{s.toUpperCase()}</span>;
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
