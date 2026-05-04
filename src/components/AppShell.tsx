import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-types";
import {
  LayoutDashboard,
  Users,
  Layers3,
  ClipboardList,
  Bell,
  Gift,
  Receipt,
  Palette,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  Crown,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { currentMonth } from "@/lib/format";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: () => string | number | null;
  badgeTone?: "muted" | "warn";
  exact?: boolean;
};

const NAV_MAIN: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/subscribers", label: "Subscribers", icon: Users },
  { to: "/groups", label: "Chit Groups", icon: Layers3 },
  { to: "/data-entry", label: "Data Entry", icon: ClipboardList, badgeTone: "warn" },
];

const NAV_COMM: NavItem[] = [
  { to: "/communications/reminders", label: "Reminders", icon: Bell },
  { to: "/communications/offers", label: "Offers", icon: Gift },
  { to: "/communications/receipts", label: "Receipts", icon: Receipt },
];

const NAV_FOOTER: NavItem[] = [
  { to: "/templates", label: "Templates", icon: Palette },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/subscribers": "Subscribers",
  "/groups": "Chit Groups",
  "/data-entry": "Monthly Data Entry",
  "/dispatch": "Dispatch",
  "/communications/reminders": "Reminders",
  "/communications/offers": "Offers",
  "/communications/receipts": "Receipts",
  "/templates": "Templates",
  "/settings": "Settings",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, user, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Live counts for sidebar badges
  const counts = useQuery({
    queryKey: ["sidebar-counts"],
    queryFn: async () => {
      const month = currentMonth();
      const [subs, groups, entries] = await Promise.all([
        db.from("subscribers").select("id", { count: "exact", head: true }).eq("active", true),
        db.from("chit_groups").select("id", { count: "exact", head: true }).eq("status", "active"),
        db.from("monthly_entries").select("group_id", { count: "exact", head: true }).eq("month", month),
      ]);
      const groupCount = groups.count ?? 0;
      const entryCount = entries.count ?? 0;
      return {
        subscribers: subs.count ?? 0,
        groups: groupCount,
        pendingEntry: Math.max(0, groupCount - entryCount),
      };
    },
    refetchInterval: 60000,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + "/");

  const badgeFor = (item: NavItem): { value: string | number; tone: "muted" | "warn" } | null => {
    if (!counts.data) return null;
    if (item.to === "/subscribers" && counts.data.subscribers) return { value: counts.data.subscribers, tone: "muted" };
    if (item.to === "/groups" && counts.data.groups) return { value: counts.data.groups, tone: "muted" };
    if (item.to === "/data-entry" && counts.data.pendingEntry) return { value: counts.data.pendingEntry, tone: "warn" };
    return null;
  };

  const initials = (user?.email || "?").slice(0, 2).toUpperCase();
  const breadcrumb = PAGE_TITLES[location.pathname] || PAGE_TITLES[Object.keys(PAGE_TITLES).find(k => k !== "/" && location.pathname.startsWith(k)) || "/"];

  const NavSection = ({ items, label }: { items: NavItem[]; label?: string }) => (
    <div className="space-y-0.5">
      {label && (
        <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
          {label}
        </div>
      )}
      {items.map((item, i) => {
        const Icon = item.icon;
        const active = isActive(item.to, item.exact);
        const badge = badgeFor(item);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
              active
                ? "bg-[var(--navy-2)] text-white shadow-sm"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            {active && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[var(--gold)]" />
            )}
            <Icon className={cn("h-[17px] w-[17px] shrink-0 transition-transform", active && "text-[var(--gold)]")} />
            <span className="flex-1">{item.label}</span>
            {badge && (
              <span
                className={cn(
                  "num rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                  badge.tone === "warn"
                    ? "bg-[var(--gold)] text-[var(--navy)]"
                    : "bg-white/10 text-white/70",
                )}
              >
                {badge.value}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gold)] shadow-md">
          <Crown className="h-5 w-5 text-[var(--navy)]" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-lg text-white">Panasuna</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">Chits (P) Ltd.</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavSection items={NAV_MAIN} />
        <NavSection items={NAV_COMM} label="Communications" />
        <div className="my-3 h-px bg-white/5" />
        <NavSection items={NAV_FOOTER} />
        <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Tools
        </div>
        <a
          href="/chitsync.html"
          target="_blank"
          rel="noopener"
          onClick={() => setMobileOpen(false)}
          className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white"
        >
          <Crown className="h-[17px] w-[17px] shrink-0" />
          <span className="flex-1">ChitSync (AI)</span>
          <span className="rounded-full bg-[var(--gold)] px-1.5 py-0.5 text-[9px] font-semibold leading-none text-[var(--navy)]">
            NEW
          </span>
        </a>
      </nav>

      {/* User */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--gold)] text-[12px] font-bold text-[var(--navy)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-white">{user?.email}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--gold)]">{role}</div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="grid h-8 w-8 place-items-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className="hidden shrink-0 md:flex md:flex-col"
        style={{ width: "240px", background: "var(--navy)", color: "var(--sidebar-foreground)" }}
      >
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-[260px] md:hidden"
            style={{ background: "var(--navy)" }}
          >
            {SidebarContent}
          </aside>
        </>
      )}

      <main className="flex-1 overflow-x-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur md:px-8">
          <button
            className="grid h-9 w-9 place-items-center rounded-md text-text-2 hover:bg-muted md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden md:inline">Panasuna</span>
            <ChevronRight className="hidden h-3.5 w-3.5 md:block" />
            <span className="font-semibold text-foreground">{breadcrumb || "Home"}</span>
          </div>
          <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <span className="num">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
          </div>
        </header>

        <div key={location.pathname} className="page-enter px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
