import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useEffect, useMemo, useState } from "react";
import chitSyncHtml from "../../chitsync.html?raw";
import { ensureDemoState, getDemoSubscribers, subscribeDemoChanges } from "@/lib/demo-data";

export const Route = createFileRoute("/chitsync")({
  component: ChitSyncPage,
  head: () => ({ meta: [{ title: "ChitSync — Panasuna Chits" }] }),
});

function ChitSyncPage() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    ensureDemoState();
    return subscribeDemoChanges(() => setVersion((v) => v + 1));
  }, []);

  const srcDoc = useMemo(() => {
    const subs = getDemoSubscribers();
    const customers = subs.map((s) => ({
      id: s.id,
      name: s.name,
      phone: (s.whatsapp_number || "").replace(/\D/g, "").slice(-10),
      phone2: (s.alt_number || "").replace(/\D/g, "").slice(-10),
      address: [s.address_line1, s.address_line2, s.city, s.pincode].filter(Boolean).join(", "),
      source: "panasuna",
      created_at: new Date().toISOString(),
    }));
    const bootstrap = `<script>window.__PANASUNA_CUSTOMERS__ = ${JSON.stringify(customers)};</script>`;
    return chitSyncHtml.replace("</head>", `${bootstrap}\n</head>`);
    // version is in the dep list to force memo refresh on demo changes
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ProtectedLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ChitSync</h1>
          <p className="text-sm text-muted-foreground">
            Subscribers from the main app are automatically loaded into ChitSync as customers. Changes you make here stay in this workspace; new subscribers added in the main app will appear on next refresh.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <iframe
            key={version}
            title="ChitSync"
            srcDoc={srcDoc}
            className="h-[calc(100vh-14rem)] w-full border-0"
          />
        </div>
      </div>
    </ProtectedLayout>
  );
}
