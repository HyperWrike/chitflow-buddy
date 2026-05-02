import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Bell, Gift, Receipt } from "lucide-react";

export const Route = createFileRoute("/communications/offers")({
  component: () => (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display">Offers</h1>
          <p className="text-text-2">Bulk WhatsApp campaigns: image + message + audience + timing.</p>
        </div>
        <div className="flex gap-2">
          <Tab to="/communications/reminders" label="Reminders" Icon={Bell} />
          <Tab to="/communications/offers" label="Offers" Icon={Gift} active />
          <Tab to="/communications/receipts" label="Receipts" Icon={Receipt} />
        </div>
        <div className="rounded-xl border border-dashed border-border-2 bg-surface-2 p-12 text-center text-sm text-muted-foreground">
          Offers module — coming in Phase 6.
        </div>
      </div>
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Offers — Panasuna Chits" }] }),
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
