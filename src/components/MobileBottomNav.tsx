import { useLocation, useNavigate } from "react-router-dom";
import { Landmark, TrendingUp, Zap, ArrowDownToLine, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Conta", icon: Landmark, path: "/dashboard" },
  { label: "Vendas", icon: TrendingUp, path: "/sales" },
  { label: "", icon: Zap, path: "/products", center: true },
  { label: "Saque", icon: ArrowDownToLine, path: "/finance" },
  { label: "Ajustes", icon: Settings, path: "/admin/settings" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md md:hidden">
      <div className="flex items-end justify-around px-2 pb-[env(safe-area-inset-bottom)] h-16">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;

          if (tab.center) {
            return (
              <button
                key="center"
                onClick={() => navigate(tab.path)}
                className="relative -top-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg glow-primary"
              >
                <tab.icon className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-[0.6rem] font-medium tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
