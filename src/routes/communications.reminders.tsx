import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Bell, Gift, Receipt } from "lucide-react";

export const Route = createFileRoute("/communications/reminders")({
  component: () => (
    <ProtectedLayout>
      <Hub active="reminders" />
    </ProtectedLayout>
  ),
  head: () => ({ meta: [{ title: "Reminders — Panasuna Chits" }] }),
});

function Hub({ active }: { active: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display">Reminders</h1>
          <p className="text-text-2">Schedule and dispatch monthly auction notices.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Tab to="/communications/reminders" label="Reminders" Icon={Bell} active={active === "reminders"} />
        <Tab to="/communications/offers" label="Offers" Icon={Gift} active={active === "offers"} />
        <Tab to="/communications/receipts" label="Receipts" Icon={Receipt} active={active === "receipts"} />
      </div>
      <div className="rounded-xl border border-dashed border-border-2 bg-surface-2 p-12 text-center text-sm text-muted-foreground">
        Reminders module — coming in Phase 6.
      </div>
    </div>
  );
}

function Tab({ to, label, Icon, active }: { to: string; label: string; Icon: typeof Bell; active: boolean }) {
  return (
    <Link
      to={to}
      className={
        "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition " +
        (active
          ? "border-navy bg-navy text-white"
          : "border-border bg-surface text-text-2 hover:border-border-2")
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
