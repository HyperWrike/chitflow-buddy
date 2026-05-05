import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useEffect } from "react";
import chitSyncHtml from "../../chitsync.html?raw";
import { ensureDemoState } from "@/lib/demo-data";

export const Route = createFileRoute("/chitsync")({
  component: ChitSyncPage,
  head: () => ({ meta: [{ title: "ChitSync — Panasuna Chits" }] }),
});

function ChitSyncPage() {
  useEffect(() => {
    ensureDemoState();
  }, []);

  return (
    <ProtectedLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ChitSync</h1>
          <p className="text-sm text-muted-foreground">
            Embedded inside the app so you can use the same workspace without opening a separate HTML file.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <iframe
            title="ChitSync"
            srcDoc={chitSyncHtml}
            className="h-[calc(100vh-14rem)] w-full border-0"
          />
        </div>
      </div>
    </ProtectedLayout>
  );
}