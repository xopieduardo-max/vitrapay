import {
  LayoutDashboard, Users, ArrowDownToLine, Settings, Image, MessageSquareMore, ArrowLeft, ShoppingBag, Lightbulb, Bell, Calculator, ShieldAlert, Receipt, ShoppingCart, ClipboardList, Trophy, Package, MessagesSquare,
} from "lucide-react";
import { ThemeLogo } from "@/components/ThemeLogo";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Usuários", url: "/admin/users", icon: Users, badgeKey: "newUsers" as const },
  { title: "Produtos", url: "/admin/products", icon: Package },
  { title: "Saques", url: "/admin/withdrawals", icon: ArrowDownToLine, badgeKey: "pendingWithdrawals" as const },
  { title: "Mensagens", url: "/admin/support", icon: MessagesSquare, badgeKey: "unreadSupport" as const },
  { title: "Comunidade", url: "/admin/community", icon: Lightbulb },
  { title: "Banners", url: "/admin/banners", icon: Image },
  { title: "Pop-ups", url: "/admin/popups", icon: MessageSquareMore },
  { title: "Notificações Push", url: "/admin/push", icon: Bell },
  { title: "GV +", url: "/admin/fake-sales", icon: ShoppingBag },
  { title: "Simulador de Taxas", url: "/admin/fee-simulator", icon: Calculator },
  { title: "Transações", url: "/admin/transactions", icon: Receipt },
  { title: "Recuperação", url: "/admin/cart-recovery", icon: ShoppingCart },
  { title: "Disputas", url: "/admin/disputes", icon: ShieldAlert },
  { title: "Placas de Premiação", url: "/admin/awards", icon: Trophy },
  { title: "Configurações", url: "/admin/settings", icon: Settings },
  { title: "Log Admin", url: "/admin/audit", icon: ClipboardList },
];

const LAST_SEEN_KEY = "admin_users_last_seen_at";

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const [lastSeen, setLastSeen] = useState<string | null>(
    () => localStorage.getItem(LAST_SEEN_KEY),
  );

  useEffect(() => {
    const handler = () => setLastSeen(localStorage.getItem(LAST_SEEN_KEY));
    window.addEventListener("admin-users-seen", handler);
    return () => window.removeEventListener("admin-users-seen", handler);
  }, []);

  // Counters for sidebar badges
  const { data: counters = { newUsers: 0, pendingWithdrawals: 0, unreadSupport: 0 } } = useQuery({
    queryKey: ["admin-sidebar-counters", lastSeen],
    refetchInterval: 30_000,
    queryFn: async () => {
      const cutoff = lastSeen || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [{ count: newUsers }, { count: pendingWithdrawals }, { data: support }] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).gt("created_at", cutoff),
        supabase.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("unread_for_admin"),
      ]);
      const unreadSupport = (support || []).reduce((a: number, t: any) => a + (t.unread_for_admin || 0), 0);
      return {
        newUsers: newUsers || 0,
        pendingWithdrawals: pendingWithdrawals || 0,
        unreadSupport,
      };
    },
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <NavLink to="/admin" className="flex items-center gap-2">
          <ThemeLogo variant="icon" className="h-8 w-8 rounded-lg object-contain" />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-foreground">
              Admin
            </span>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const count = item.badgeKey ? counters[item.badgeKey] : 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        end
                        className="gap-3 text-sm transition-colors relative"
                        activeClassName="bg-destructive/10 text-destructive font-medium"
                      >
                        <span className="relative shrink-0">
                          <item.icon className="h-4 w-4" strokeWidth={1.5} />
                          {count > 0 && collapsed && (
                            <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                          )}
                        </span>
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            {count > 0 && (
                              <span className="text-[0.6rem] font-semibold bg-primary text-primary-foreground rounded-full px-1.5 min-w-[18px] text-center leading-[18px]">
                                {count > 99 ? "99+" : count}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <NavLink to="/dashboard" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          {!collapsed && <span>Voltar ao painel</span>}
        </NavLink>
      </SidebarFooter>
    </Sidebar>
  );
}
