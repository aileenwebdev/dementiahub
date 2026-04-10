import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { Activity, Brain, History, LayoutDashboard, LogOut, MessageSquare, Phone, ShieldCheck, User } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: MessageSquare, label: "AI Assistant", path: "/assistant" },
  { icon: Phone, label: "Start a Call", path: "/call" },
  { icon: History, label: "Call History", path: "/history" },
  { icon: User, label: "My Profile", path: "/profile" },
];

const adminMenuItems = [
  { icon: Activity, label: "All Conversations", path: "/admin/conversations" },
  { icon: ShieldCheck, label: "Integration Status", path: "/admin/integration" },
];

export default function DashboardLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="cg-auth-shell flex min-h-screen items-center justify-center px-4">
        <div className="cg-form-card w-full max-w-md rounded-[2rem] p-8 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d4e4b] text-white">
            <Brain className="h-7 w-7" />
          </div>
          <h1 className="cg-display text-3xl font-bold text-[#0f2e2c]">Dementia<span className="text-[#d4935a]">SG</span></h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Secure access to your caregiver portal, support assistant, and saved conversation history.
          </p>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} className="mt-6 h-12 w-full rounded-2xl bg-[#1d4e4b] hover:bg-[#0f2e2c]">
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  const visibleItems = user.role === "admin" ? [...menuItems, ...adminMenuItems] : menuItems;

  return (
    <div className="min-h-screen bg-transparent">
      <header className="cg-topbar sticky top-0 z-40">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8">
              <Brain className="h-5 w-5 text-[#edb27e]" />
            </div>
            <div>
              <p className="cg-display text-2xl font-bold text-white">Dementia<span className="text-[#edb27e]">SG</span></p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">Caregiver Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isMobile && (
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
                AI assistant online
              </div>
            )}
            <div className="flex items-center gap-3 rounded-full bg-white/6 px-2 py-2">
              <Avatar className="h-9 w-9 border border-white/10">
                <AvatarFallback className="bg-gradient-to-br from-[#7a9e8a] to-[#d4935a] text-xs font-semibold text-white">
                  {user.name?.charAt(0).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              {!isMobile && (
                <div className="pr-2">
                  <p className="text-sm font-medium text-white">{user.name || "User"}</p>
                  <p className="text-xs text-white/45">{user.email || "Caregiver account"}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap gap-2">
          {visibleItems.map((item) => {
            const active = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={cn(
                  "cg-nav-pill inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-[#527a68] transition-all",
                  active && "cg-nav-pill-active text-white"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-full border border-transparent px-4 py-2.5 text-sm font-medium text-[#7a7a72] transition-colors hover:text-[#1d4e4b]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </nav>

        <div className={cn("cg-shell grid gap-6", sidebar ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1")}>
          <main className="min-w-0">{children}</main>
          {sidebar ? <aside className="hidden xl:block">{sidebar}</aside> : null}
        </div>
      </div>
    </div>
  );
}
