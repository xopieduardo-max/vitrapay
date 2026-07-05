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
  
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { User, LogOut, Moon, Sun, ChevronDown, LifeBuoy, ShoppingBag, Rocket, Home, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUnreadSupport } from "@/hooks/useUnreadSupport";
import { Badge } from "@/components/ui/badge";

type ViewMode = "buyer" | "producer";

export function UserHeaderDropdown({ compact = false }: { compact?: boolean } = {}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { unread: unreadSupport, pulse: supportPulse, hasUnread: hasUnreadSupport } = useUnreadSupport();

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "dark";
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "buyer";
    return (localStorage.getItem("viewMode") as ViewMode) || "buyer";
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
      description: mode === "producer" ? "Painel de vendas e produtos." : "Seus cursos e produtos comprados.",
    });
    navigate(mode === "producer" ? "/dashboard" : "/home");
  };

  // In buyer mode (or for buyer-only users), show the simplified Kiwify-style menu.
  const buyerMode = !isProducer || viewMode === "buyer";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors outline-none w-full">
          <div className="relative shrink-0">
            <Avatar className="h-8 w-8 border border-border shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            {hasUnreadSupport && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 ${supportPulse ? "animate-ping" : ""}`}></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary border border-background"></span>
              </span>
            )}
          </div>
          <div className="flex flex-col items-start leading-tight min-w-0 flex-1">
            <span className="text-sm font-medium truncate max-w-full">{displayName}</span>
            {isProducer && (
              <span className="text-[10px] text-muted-foreground">
                Modo {viewMode === "producer" ? "Produtor" : "Comprador"}
              </span>
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">

        {buyerMode ? (
          <>
            <DropdownMenuItem onClick={() => navigate("/home")} className="gap-3 cursor-pointer">
              <Home className="h-4 w-4" />
              Página Inicial
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-3 cursor-pointer">
              <UserCircle className="h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            {isProducer && (
              <DropdownMenuItem onClick={() => switchMode("producer")} className="gap-3 cursor-pointer">
                <Rocket className="h-4 w-4 text-primary" />
                Mudar para produtor
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate("/support")} className={`gap-3 cursor-pointer ${hasUnreadSupport ? "bg-primary/5" : ""}`}>
              <LifeBuoy className={`h-4 w-4 ${hasUnreadSupport ? "text-primary" : ""}`} />
              <span className="flex-1">Ajuda & Suporte</span>
              {hasUnreadSupport && (
                <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-primary text-primary-foreground">
                  {unreadSupport > 9 ? "9+" : unreadSupport}
                </Badge>
              )}
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
              Logout
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-3 cursor-pointer">
              <User className="h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchMode("buyer")} className="gap-3 cursor-pointer">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Mudar para o painel do aluno
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/support")} className={`gap-3 cursor-pointer ${hasUnreadSupport ? "bg-primary/5" : ""}`}>
              <LifeBuoy className={`h-4 w-4 ${hasUnreadSupport ? "text-primary" : ""}`} />
              <span className="flex-1">Ajuda & Suporte</span>
              {hasUnreadSupport && (
                <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-primary text-primary-foreground">
                  {unreadSupport > 9 ? "9+" : unreadSupport}
                </Badge>
              )}
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
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
