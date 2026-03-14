import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Shield, Package, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockUsers = [
  { id: "1", name: "Admin Master", email: "admin@aether.com", role: "admin", joined: "01/01/2026" },
  { id: "2", name: "Dev Academy", email: "dev@academy.com", role: "producer", joined: "15/01/2026" },
  { id: "3", name: "João Silva", email: "joao@email.com", role: "buyer", joined: "20/02/2026" },
  { id: "4", name: "Growth Lab", email: "growth@lab.com", role: "producer", joined: "05/02/2026" },
  { id: "5", name: "Maria Santos", email: "maria@email.com", role: "buyer", joined: "10/03/2026" },
];

const roleConfig = {
  admin: { label: "Admin", icon: Shield, className: "bg-accent/10 text-accent border-accent/20" },
  producer: { label: "Produtor", icon: Package, className: "bg-primary/10 text-primary border-primary/20" },
  buyer: { label: "Comprador", icon: ShoppingCart, className: "bg-warning/10 text-warning border-warning/20" },
};

export default function AdminUsers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-title">Gerenciar Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">Painel administrativo</p>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_180px_100px_100px_50px] gap-4 px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-label text-muted-foreground">
          <span>Nome</span>
          <span>Email</span>
          <span>Função</span>
          <span>Cadastro</span>
          <span></span>
        </div>
        {mockUsers.map((user, i) => {
          const rc = roleConfig[user.role as keyof typeof roleConfig];
          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="grid grid-cols-[1fr_180px_100px_100px_50px] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
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
                  <DropdownMenuItem className="text-sm">Editar</DropdownMenuItem>
                  <DropdownMenuItem className="text-sm text-destructive">Suspender</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
