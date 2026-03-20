import {
  LayoutDashboard,
  Package,
  Store,
  ShoppingBag,
  FileText,
  Users,
  Landmark,
  Shield,
  MessageCircle,
  Settings,
  Smartphone,
} from "lucide-react";
import { ThemeLogo } from "@/components/ThemeLogo";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const REVENUE_GOAL = 1000000;

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Produtos", url: "/products", icon: Package },
  { title: "Oportunidades", url: "/marketplace", icon: Store },
  { title: "Minhas Vendas", url: "/sales", icon: ShoppingBag },
  { title: "Relatórios", url: "/purchases", icon: FileText },
  { title: "Minhas Afiliações", url: "/affiliates", icon: Users },
  { title: "Financeiro", url: "/finance", icon: Landmark },
  { title: "Comunidade", url: "/community", icon: MessageCircle },
  { title: "Ajustes", url: "/settings", icon: Settings },
  { title: "Baixar App", url: "/install", icon: Smartphone },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();
  const isActive = (path: string) => location.pathname === path;

  const { data: totalRevenue = 0 } = useQuery({
    queryKey: ["sidebar-revenue", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data } = await supabase
        .from("sales")
        .select("amount, platform_fee, status")
        .eq("producer_id", user.id)
        .eq("status", "completed");
      return (data || []).reduce((acc, s) => acc + (s.amount - (s.platform_fee || 0)), 0);
    },
    enabled: !!user,
  });

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin-sidebar", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  const revenueProgress = Math.min((totalRevenue / REVENUE_GOAL) * 100, 100);
  const fmt = (v: number) =>
    `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <NavLink to="/" className="flex items-center gap-2">
          <ThemeLogo variant="icon" className="h-9 w-9 rounded-lg object-contain" />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-foreground">
              VitraPay
            </span>
          )}
        </NavLink>
      </SidebarHeader>

      {/* Faturamento Widget */}
      {!collapsed && (
        <div className="px-3 mb-2">
          <div className="rounded-lg border border-primary/30 bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="" className="h-7 w-7 rounded-md object-contain" />
              <div>
                <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Faturamento</p>
                <p className="text-sm font-bold">
                  {fmt(totalRevenue)} <span className="text-xs font-normal text-muted-foreground">/ {fmt(REVENUE_GOAL)}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={revenueProgress} className="h-1.5 flex-1" />
              <span className="text-[0.6rem] text-muted-foreground">{revenueProgress.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end
                      className="gap-3 text-sm transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Admin link - only for admins */}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin")}>
                    <NavLink
                      to="/admin"
                      className="gap-3 text-sm transition-colors"
                      activeClassName="bg-destructive/10 text-destructive font-medium"
                    >
                      <Shield className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      {!collapsed && <span>Painel Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3" />
    </Sidebar>
  );
}
