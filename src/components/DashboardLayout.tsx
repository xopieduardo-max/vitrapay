import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { PlatformPopup } from "@/components/PlatformPopup";
import { TermsAcceptanceModal } from "@/components/TermsAcceptanceModal";
import { useSalesNotifications } from "@/hooks/useSalesNotifications";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { UserHeaderDropdown } from "@/components/UserHeaderDropdown";
import { ThemeLogo } from "@/components/ThemeLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useCallback } from "react";

/**
 * Wrapper that opens the sidebar on hover and collapses on leave.
 * The user can still "pin" the sidebar open by clicking the SidebarTrigger.
 */
function HoverSidebar({ pinned }: { pinned: boolean }) {
  const { setOpen, isMobile } = useSidebar();
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (isMobile || pinned) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setOpen(true);
  }, [isMobile, pinned, setOpen]);

  const handleLeave = useCallback(() => {
    if (isMobile || pinned) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setOpen(false), 120);
  }, [isMobile, pinned, setOpen]);

  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="contents"
    >
      <AppSidebar />
    </div>
  );
}

export function DashboardLayout() {
  const { newSalesCount, notifications, clearCount } = useSalesNotifications();
  usePushNotifications();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Controlled sidebar: collapsed by default, expands on hover.
  // "pinned" lets the user lock it open via the trigger button.
  const [pinned, setPinned] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["layout-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const firstName = profile?.display_name?.split(" ")[0] || "";

  return (
    <SidebarProvider
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Manual toggle = pin/unpin
        setPinned(o);
      }}
      defaultOpen={false}
    >
      <div className="min-h-screen flex w-full bg-background">
        <HoverSidebar pinned={pinned} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            <SidebarTrigger
              className="text-muted-foreground hover:text-foreground hidden md:flex"
              title={pinned ? "Desafixar menu" : "Fixar menu"}
            />

            {/* Desktop: always show full search */}
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="Buscar... (Cmd+K)"
                className="pl-9 h-9 bg-muted/50 border-transparent focus:border-border text-sm"
              />
            </div>

            {/* Mobile: logo + greeting */}
            <div className="md:hidden flex items-center gap-2">
              <button onClick={() => navigate("/dashboard")} className="shrink-0">
                <ThemeLogo variant="horizontal" className="h-6" />
              </button>
              {firstName && (
                <span className="text-sm text-muted-foreground truncate max-w-[140px]">
                  Olá, <span className="text-foreground font-medium">{firstName}</span>
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-4">
              <NotificationsDropdown
                count={newSalesCount}
                notifications={notifications}
                onClear={clearCount}
              />
              <UserHeaderDropdown />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
        <MobileBottomNav />
        <PlatformPopup />
        <TermsAcceptanceModal />
      </div>
    </SidebarProvider>
  );
}
