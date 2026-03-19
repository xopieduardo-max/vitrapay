import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Shield, Package, ShoppingCart, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

const roleConfig = {
  admin: { label: "Admin", icon: Shield, className: "bg-accent/10 text-accent border-accent/20" },
  producer: { label: "Produtor", icon: Package, className: "bg-primary/10 text-primary border-primary/20" },
  buyer: { label: "Comprador", icon: ShoppingCart, className: "bg-warning/10 text-warning border-warning/20" },
};

export default function AdminUsers() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, created_at")
        .order("created_at", { ascending: false });

      if (!profiles) return [];

      // Get all roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const rolesMap: Record<string, string[]> = {};
      (roles || []).forEach((r: any) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      });

      return profiles.map((p: any) => {
        const userRoles = rolesMap[p.user_id] || ["buyer"];
        // Show highest role
        const role = userRoles.includes("admin") ? "admin" : userRoles.includes("producer") ? "producer" : "buyer";
        return {
          id: p.user_id,
          name: p.display_name || "Sem nome",
          joined: format(new Date(p.created_at), "dd/MM/yyyy"),
          role,
        };
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gerenciar Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {users.length} usuário(s) cadastrado(s)
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_100px_50px] gap-4 px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <span>Nome</span>
          <span>Função</span>
          <span>Cadastro</span>
          <span></span>
        </div>
        {users.map((user: any, i: number) => {
          const rc = roleConfig[user.role as keyof typeof roleConfig] || roleConfig.buyer;
          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="grid grid-cols-[1fr_100px_100px_50px] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <span className="text-sm font-medium truncate">{user.name}</span>
              <Badge variant="outline" className={`text-[0.65rem] w-fit gap-1 ${rc.className}`}>
                <rc.icon className="h-3 w-3" strokeWidth={1.5} />
                {rc.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{user.joined}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-sm">Ver perfil</DropdownMenuItem>
                  <DropdownMenuItem className="text-sm text-destructive">Suspender</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          );
        })}
        {users.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum usuário cadastrado.
          </div>
        )}
      </div>
    </div>
  );
}