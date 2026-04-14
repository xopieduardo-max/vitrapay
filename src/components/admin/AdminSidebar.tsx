import {
  LayoutDashboard, Users, ArrowDownToLine, Settings, Image, MessageSquareMore, ArrowLeft, ShoppingBag, Lightbulb, Bell, Calculator, ShieldAlert, Receipt, ShoppingCart, ClipboardList,
} from "lucide-react";
import { ThemeLogo } from "@/components/ThemeLogo";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Usuários", url: "/admin/users", icon: Users },
  { title: "Saques", url: "/admin/withdrawals", icon: ArrowDownToLine },
  { title: "Comunidade", url: "/admin/community", icon: Lightbulb },
  { title: "Banners", url: "/admin/banners", icon: Image },
  { title: "Pop-ups", url: "/admin/popups", icon: MessageSquareMore },
  { title: "Notificações Push", url: "/admin/push", icon: Bell },
  { title: "GV +", url: "/admin/fake-sales", icon: ShoppingBag },
  { title: "Simulador de Taxas", url: "/admin/fee-simulator", icon: Calculator },
  { title: "Transações", url: "/admin/transactions", icon: Receipt },
  { title: "Recuperação", url: "/admin/cart-recovery", icon: ShoppingCart },
  { title: "Disputas", url: "/admin/disputes", icon: ShieldAlert },
  { title: "Configurações", url: "/admin/settings", icon: Settings },
  { title: "Log Admin", url: "/admin/audit", icon: ClipboardList },
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
