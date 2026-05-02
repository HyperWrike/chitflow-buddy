import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/templates")({
  component: () => (
    <ProtectedLayout>
      <TemplatesPage />
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Templates — Panasuna Chits" }] }),
});

type Theme = {
  id: string;
  name: string;
  type: "RECEIPT" | "REMINDER";
  header: string;
  accent: string;
  bg: string;
  text: string;
  description: string;
};

const THEMES: Theme[] = [
  { id: "classic-navy", name: "Classic Navy", type: "REMINDER", header: "#0f2744", accent: "#f5a623", bg: "#ffffff", text: "#0f1923", description: "Default Panasuna theme. Navy header, gold bar." },
  { id: "clean-white", name: "Clean White", type: "RECEIPT", header: "#1f2937", accent: "#3b82f6", bg: "#ffffff", text: "#0f172a", description: "Minimalist black-and-blue accent." },
  { id: "gold-warm", name: "Gold Warm", type: "RECEIPT", header: "#92400e", accent: "#fbbf24", bg: "#fffbeb", text: "#451a03", description: "Warm cream background with gold tones." },
  { id: "fresh-green", name: "Fresh Green", type: "REMINDER", header: "#065f46", accent: "#34d399", bg: "#f0fdf4", text: "#022c22", description: "Calming green for reminders." },
  { id: "corporate-blue", name: "Corporate Blue", type: "RECEIPT", header: "#1e40af", accent: "#60a5fa", bg: "#eff6ff", text: "#1e3a8a", description: "Professional blue palette." },
  { id: "premium-dark", name: "Premium Dark", type: "REMINDER", header: "#0c0a09", accent: "#facc15", bg: "#fafaf9", text: "#1c1917", description: "Premium black with gold accents." },
];

function TemplatesPage() {
  const [defaults, setDefaults] = useState<Record<string, string>>({ RECEIPT: "clean-white", REMINDER: "classic-navy" });

  const setDefault = (theme: Theme) => {
    setDefaults((d) => ({ ...d, [theme.type]: theme.id }));
    toast.success(`${theme.name} set as default ${theme.type.toLowerCase()} template`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display">Templates</h1>
          <p className="text-text-2">Pick a default theme for receipts and reminders.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {THEMES.map((t) => {
          const isDefault = defaults[t.type] === t.id;
          return (
            <div key={t.id} className="rounded-xl border bg-surface overflow-hidden flex flex-col">
              <div style={{ background: t.bg, height: 180, position: "relative" }}>
                <div style={{ background: t.header, color: "white", padding: "10px 14px", fontSize: 12, fontWeight: 700 }}>
                  Panasuna Chits (P) Ltd
                </div>
                <div style={{ background: t.accent, color: t.header, padding: "4px 14px", fontSize: 10, fontWeight: 600 }}>
                  Phone: 9842567890 · {t.type === "RECEIPT" ? "ACKNOWLEDGEMENT" : "Statement"}
                </div>
                <div style={{ padding: "10px 14px", fontSize: 11, color: t.text, lineHeight: 1.5 }}>
                  <strong>Mrs. Bhuvaneswari</strong><br />
                  413-C Big Bazaar Street<br />
                  Salem – 636 007
                </div>
                <div style={{ position: "absolute", bottom: 8, left: 14, right: 14, background: t.accent, color: t.header, fontSize: 10, padding: "4px 8px", textAlign: "right", fontWeight: 700, borderRadius: 4 }}>
                  Total: ₹ 2,06,900
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      {t.name}
                      {isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{t.type}</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground flex-1">{t.description}</p>
                <div className="mt-3 flex gap-2">
                  {isDefault ? (
                    <span className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded bg-green-50 text-green-700 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Default
                    </span>
                  ) : (
                    <button onClick={() => setDefault(t)} className="flex-1 text-xs px-3 py-2 rounded border bg-surface hover:bg-accent font-medium">
                      Set as default
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed bg-surface/40 p-6 text-center text-sm text-muted-foreground">
        Full template editor (custom colors, fonts, footer text, WYSIWYG) coming soon.
      </div>
    </div>
  );
}
