import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { User, LogOut, Moon, Sun, ChevronDown, LifeBuoy, ShoppingBag, Rocket, Check, Home, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "buyer" | "producer";

export function UserHeaderDropdown() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "dark";
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "producer";
    return (localStorage.getItem("viewMode") as ViewMode) || "producer";
  });

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const { data: profile } = useQuery({
    queryKey: ["profile-header", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: roles } = useQuery({
    queryKey: ["user-roles-header", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return (data || []).map((r) => r.role);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const isProducer = roles?.includes("producer");

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Usuário";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const switchMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("viewMode", mode);
    toast({
      title: mode === "producer" ? "Modo Produtor ativado" : "Modo Comprador ativado",
      description: mode === "producer" ? "Painel de vendas e produtos." : "Suas compras e biblioteca.",
    });
    navigate(mode === "producer" ? "/dashboard" : "/purchases");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors outline-none">
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium truncate max-w-[120px]">{displayName}</span>
            {isProducer && (
              <span className="text-[10px] text-muted-foreground">
                Modo {viewMode === "producer" ? "Produtor" : "Comprador"}
              </span>
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {isProducer && (
          <>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Trocar de modo
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => switchMode("producer")}
              className="gap-3 cursor-pointer"
            >
              <Rocket className="h-4 w-4 text-primary" />
              <span className="flex-1">Modo Produtor</span>
              {viewMode === "producer" && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => switchMode("buyer")}
              className="gap-3 cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="flex-1">Modo Comprador</span>
              {viewMode === "buyer" && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-3 cursor-pointer">
          <User className="h-4 w-4" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/support")} className="gap-3 cursor-pointer">
          <LifeBuoy className="h-4 w-4" />
          Ajuda & Suporte
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div
          className="flex items-center justify-between px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <span className="flex items-center gap-3">
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            Modo noturno
          </span>
          <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="gap-3 cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
