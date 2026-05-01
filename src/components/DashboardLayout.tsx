import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
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
import { useState, useRef, useEffect } from "react";

/**
 * Wrapper that opens the sidebar on hover and collapses on mouse leave.
 * Listens on the actual fixed sidebar panel (data-sidebar="sidebar") so the
 * hover zone matches the visible width in both collapsed and expanded states.
 */
function HoverSidebar() {
  const { setOpen, isMobile } = useSidebar();
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isMobile) return;

    const clearLeave = () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
        leaveTimer.current = null;
      }
    };

    const onEnter = () => {
      clearLeave();
      setOpen(true);
    };

    const onLeave = () => {
      clearLeave();
      leaveTimer.current = setTimeout(() => setOpen(false), 150);
    };

    // Attach to both the gap wrapper (peer) and the fixed panel.
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-sidebar="sidebar"], [data-side="left"]'
      )
    );

    targets.forEach((el) => {
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
    });

    return () => {
      clearLeave();
      targets.forEach((el) => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
      });
    };
  }, [isMobile, setOpen]);

  return <AppSidebar />;
}

export function DashboardLayout() {
  const { newSalesCount, notifications, clearCount } = useSalesNotifications();
  usePushNotifications();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Controlled sidebar: collapsed by default, expands on hover and closes on mouse leave.
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
      onOpenChange={setOpen}
      defaultOpen={false}
    >
      <div className="min-h-screen flex w-full bg-background">
        <HoverSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">

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
