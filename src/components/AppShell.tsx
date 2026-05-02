import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Users,
  Layers3,
  ClipboardList,
  Send,
  LogOut,
  Sparkles,
  Crown,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getWhatsAppModeLabel } from "@/lib/whatsapp";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subscribers", label: "Subscribers", icon: Users },
  { to: "/groups", label: "Chit Groups", icon: Layers3 },
  { to: "/data-entry", label: "Monthly Entry", icon: ClipboardList },
  { to: "/dispatch", label: "Dispatch", icon: Send },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, user, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const sendMode = getWhatsAppModeLabel();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold text-gold-foreground shadow-lg shadow-black/10">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg tracking-tight text-white">Panasuna Chits</div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-sidebar-foreground/60">
                Management suite
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/70 px-3 py-2 text-[11px] leading-5 text-sidebar-foreground/75">
            Salem, Tamil Nadu · Premium chit-fund operations workspace
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 px-3 py-3 text-xs">
            <div className="flex items-center gap-2 text-sidebar-foreground/90">
              <ShieldCheck className="h-4 w-4 text-gold" />
              <span className="font-medium">{sendMode}</span>
            </div>
            <div className="mt-1 truncate text-sidebar-foreground/60">{user?.email}</div>
            {role && (
              <span className="mt-2 inline-flex rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                {role}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        {/* mobile top bar */}
        <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold text-gold-foreground">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-gold">Panasuna Chits</div>
              <div className="text-[10px] text-sidebar-foreground/70">Salem management suite</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="md:hidden flex gap-1 overflow-x-auto border-b bg-card px-2 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="border-b border-border/70 bg-background/80 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-4 md:px-8 md:py-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-gold" />
                Panasuna Chits (P) Ltd
              </div>
              <div className="mt-2 font-display text-2xl text-foreground md:text-3xl">
                Complete management software
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Subscribers, groups, auction entry, statements, and WhatsApp dispatch in one
                operational workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                Premium SaaS shell
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                {sendMode}
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
