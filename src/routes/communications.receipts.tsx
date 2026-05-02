import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Bell, Gift, Receipt } from "lucide-react";

export const Route = createFileRoute("/communications/receipts")({
  component: () => (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display">Receipts</h1>
          <p className="text-text-2">Tick paid groups, generate live receipt, send via WhatsApp.</p>
        </div>
        <div className="flex gap-2">
          <Tab to="/communications/reminders" label="Reminders" Icon={Bell} />
          <Tab to="/communications/offers" label="Offers" Icon={Gift} />
          <Tab to="/communications/receipts" label="Receipts" Icon={Receipt} active />
        </div>
        <div className="rounded-xl border border-dashed border-border-2 bg-surface-2 p-12 text-center text-sm text-muted-foreground">
          Receipts module — coming in Phase 6.
        </div>
      </div>
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Receipts — Panasuna Chits" }] }),
});

function Tab({ to, label, Icon, active }: { to: string; label: string; Icon: typeof Bell; active?: boolean }) {
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
