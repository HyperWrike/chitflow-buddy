import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";

export const Route = createFileRoute("/settings")({
  component: () => (
    <ProtectedLayout>
      <div className="space-y-2">
        <h1 className="text-3xl font-display">Settings</h1>
        <p className="text-text-2">Company profile, WhatsApp config, scheduler, users, audit log.</p>
        <div className="mt-6 rounded-xl border border-dashed border-border-2 bg-surface-2 p-12 text-center text-sm text-muted-foreground">
          Coming in Phase 8.
        </div>
      </div>
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Settings — Panasuna Chits" }] }),
});
