import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "./AppShell";
import { Loader2 } from "lucide-react";
import { ensureDemoState } from "@/lib/demo-data";

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const demoMode = import.meta.env.DEV;

  useEffect(() => {
    ensureDemoState();
    if (!loading && !user && !demoMode) {
      navigate({ to: "/login" });
    }
  }, [demoMode, user, loading, navigate]);

  if (loading || (!user && !demoMode)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
