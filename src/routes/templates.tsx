import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";

export const Route = createFileRoute("/templates")({
  component: () => (
    <ProtectedLayout>
      <ComingSoon title="Templates" subtitle="Manage receipt and reminder templates with live preview." />
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Templates — Panasuna Chits" }] }),
});

function ComingSoon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-display">{title}</h1>
      <p className="text-text-2">{subtitle}</p>
      <div className="mt-6 rounded-xl border border-dashed border-border-2 bg-surface-2 p-12 text-center text-sm text-muted-foreground">
        Coming in Phase 7.
      </div>
    </div>
  );
}
