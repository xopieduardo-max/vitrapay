import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Link2,
  Library,
  Settings,
  TrendingUp,
  Store,
  Zap,
  Wallet,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Marketplace", url: "/marketplace", icon: Store },
];

const producerItems = [
  { title: "Meus Produtos", url: "/products", icon: Package },
  { title: "Vendas", url: "/sales", icon: TrendingUp },
  { title: "Afiliados", url: "/affiliates", icon: Link2 },
];

const buyerItems = [
  { title: "Minha Biblioteca", url: "/library", icon: Library },
  { title: "Compras", url: "/purchases", icon: ShoppingCart },
];

const adminItems = [
  { title: "Usuários", url: "/admin/users", icon: Users },
  { title: "Configurações", url: "/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const renderGroup = (label: string, items: typeof mainItems) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[0.65rem] uppercase tracking-label text-muted-foreground/60 font-medium">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <NavLink
                  to={item.url}
                  end
                  className="gap-3 text-sm tracking-interface transition-colors"
                  activeClassName="bg-primary/10 text-primary font-medium"
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
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <NavLink to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-title text-foreground">
              Aether
            </span>
          )}
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Principal", mainItems)}
        {renderGroup("Produtor", producerItems)}
        {renderGroup("Comprador", buyerItems)}
        {renderGroup("Admin", adminItems)}
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              Plano <span className="font-medium text-primary">Pro</span>
            </p>
            <p className="text-[0.65rem] text-muted-foreground/60 mt-0.5">
              R$ 2.450 em vendas este mês
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
