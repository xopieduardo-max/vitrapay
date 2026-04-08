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
  Plug,
  Rocket,
  Columns,
  Receipt,
  ChevronDown,
} from "lucide-react";
import { ThemeLogo } from "@/components/ThemeLogo";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Meus Produtos", url: "/products", icon: Package },
  { title: "Workspace", url: "/workspace", icon: Columns },
  { title: "Marketplace", url: "/marketplace", icon: Store },
  { title: "Minhas Compras", url: "/purchases", icon: FileText },
  { title: "Minhas Afiliações", url: "/affiliates", icon: Users },
  { title: "Comunidade", url: "/community", icon: MessageCircle },
  { title: "Taxas e Plano", url: "/taxas", icon: Receipt },
  { title: "Integrações", url: "/integrations", icon: Plug },
  { title: "Baixar App", url: "/install", icon: Smartphone },
];

const salesSubItems = [
  { title: "Minhas Vendas", url: "/sales", icon: ShoppingBag },
  { title: "Financeiro", url: "/finance", icon: Landmark },
  { title: "Extrato", url: "/transactions", icon: Receipt },
];

const MILESTONES = [1000000, 10000000, 25000000, 50000000, 100000000]; // 10k, 100k, 250k, 500k, 1M in cents

function getCurrentGoal(revenue: number) {
  for (const m of MILESTONES) {
    if (revenue < m) return m;
  }
  return MILESTONES[MILESTONES.length - 1];
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [becomingProducer, setBecomingProducer] = useState(false);
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

  const { data: isProducer = false } = useQuery({
    queryKey: ["is-producer-sidebar", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "producer" });
      return !!data;
    },
    enabled: !!user,
  });

  const handleBecomeProducer = async () => {
    if (!user) return;
    setBecomingProducer(true);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "producer" } as any);
    if (error) {
      toast.error("Erro ao ativar modo produtor.");
    } else {
      toast.success("🎉 Agora você é um produtor! Crie seu primeiro produto.");
      queryClient.invalidateQueries({ queryKey: ["is-producer-sidebar"] });
    }
    setBecomingProducer(false);
  };

  const currentGoal = getCurrentGoal(totalRevenue);
  const revenueProgress = Math.min((totalRevenue / currentGoal) * 100, 100);
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
              <ThemeLogo variant="icon" className="h-7 w-7 rounded-md object-contain" />
              <div>
                <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Faturamento</p>
                <p className="text-sm font-bold">
                  {fmt(totalRevenue)} <span className="text-xs font-normal text-muted-foreground">/ {fmt(currentGoal)}</span>
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

                  {/* Insert "Vendas" collapsible after "Marketplace" */}
                  {item.url === "/marketplace" && !collapsed && (
                    <Collapsible
                      defaultOpen={salesSubItems.some((s) => isActive(s.url))}
                      className="mt-0.5"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="gap-3 text-sm transition-colors w-full justify-between">
                            <span className="flex items-center gap-3">
                              <ShoppingBag className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                              <span>Vendas</span>
                            </span>
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {salesSubItems.map((sub) => (
                              <SidebarMenuSubItem key={sub.url}>
                                <SidebarMenuSubButton asChild isActive={isActive(sub.url)}>
                                  <NavLink
                                    to={sub.url}
                                    end
                                    className="gap-3 text-sm transition-colors"
                                    activeClassName="text-primary font-medium"
                                  >
                                    <sub.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                                    <span>{sub.title}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )}

                  {/* Collapsed mode: show sub-items as regular items */}
                  {item.url === "/marketplace" && collapsed && salesSubItems.map((sub) => (
                    <SidebarMenuItem key={sub.url}>
                      <SidebarMenuButton asChild isActive={isActive(sub.url)}>
                        <NavLink
                          to={sub.url}
                          end
                          className="gap-3 text-sm transition-colors"
                          activeClassName="bg-primary/10 text-primary font-medium"
                        >
                          <sub.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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

      <SidebarFooter className="p-3">
        {!isProducer && !isAdmin && !collapsed && (
          <Button
            size="sm"
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleBecomeProducer}
            disabled={becomingProducer}
          >
            <Rocket className="h-4 w-4" />
            Quero Vender
          </Button>
        )}
        {!isProducer && !isAdmin && collapsed && (
          <Button
            size="icon"
            className="w-full h-8 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleBecomeProducer}
            disabled={becomingProducer}
            title="Quero Vender"
          >
            <Rocket className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
