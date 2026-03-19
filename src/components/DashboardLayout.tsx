import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { PlatformPopup } from "@/components/PlatformPopup";
import { TermsAcceptanceModal } from "@/components/TermsAcceptanceModal";
import { useSalesNotifications } from "@/hooks/useSalesNotifications";
import { Button } from "@/components/ui/button";

export function DashboardLayout() {
  const { newSalesCount, clearCount } = useSalesNotifications();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground hidden md:flex" />
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="Buscar... (Cmd+K)"
                className="pl-9 h-9 bg-muted/50 border-transparent focus:border-border text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9"
              onClick={clearCount}
            >
              <Bell className="h-4 w-4" strokeWidth={1.5} />
              {newSalesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
                  {newSalesCount > 99 ? "99+" : newSalesCount}
                </span>
              )}
            </Button>
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