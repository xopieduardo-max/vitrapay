import { useState, useRef, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { PlatformPopup } from "@/components/PlatformPopup";
import { TermsAcceptanceModal } from "@/components/TermsAcceptanceModal";
import { useSalesNotifications } from "@/hooks/useSalesNotifications";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { UserHeaderDropdown } from "@/components/UserHeaderDropdown";

export function DashboardLayout() {
  const { newSalesCount, notifications, clearCount } = useSalesNotifications();
  usePushNotifications();

  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground hidden md:flex" />

            {/* Desktop: always show full search */}
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="Buscar... (Cmd+K)"
                className="pl-9 h-9 bg-muted/50 border-transparent focus:border-border text-sm"
              />
            </div>

            {/* Mobile: icon-only, expands on click */}
            <div className="md:hidden flex items-center">
              {!searchOpen ? (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Search className="h-4 w-4" strokeWidth={1.5} />
                </button>
              ) : (
                <div className="relative w-[calc(100vw-120px)] animate-in slide-in-from-left-2 duration-200">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    ref={inputRef}
                    placeholder="Buscar..."
                    className="pl-9 h-9 bg-muted/50 border-border text-sm"
                    onBlur={() => setSearchOpen(false)}
                  />
                </div>
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
