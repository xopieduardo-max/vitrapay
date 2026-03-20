import {
  LayoutDashboard, Users, ArrowDownToLine, Settings, Image, MessageSquareMore, Zap, ArrowLeft, ShoppingBag, Lightbulb, Bell,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Gerar Vendas", url: "/admin/fake-sales", icon: ShoppingBag },
  { title: "Usuários", url: "/admin/users", icon: Users },
  { title: "Saques", url: "/admin/withdrawals", icon: ArrowDownToLine },
  { title: "Comunidade", url: "/admin/community", icon: Lightbulb },
  { title: "Banners", url: "/admin/banners", icon: Image },
  { title: "Pop-ups", url: "/admin/popups", icon: MessageSquareMore },
  { title: "Configurações", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <NavLink to="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive">
            <Zap className="h-4 w-4 text-destructive-foreground" strokeWidth={2} />
          </div>
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
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end
                      className="gap-3 text-sm transition-colors"
                      activeClassName="bg-destructive/10 text-destructive font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
