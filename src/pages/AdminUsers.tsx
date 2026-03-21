import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Shield, Package, ShoppingCart, Loader2, Search, ChevronLeft, ChevronRight, Percent } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";

const roleConfig = {
  admin: { label: "Admin", icon: Shield, className: "bg-accent/10 text-accent border-accent/20" },
  producer: { label: "Produtor", icon: Package, className: "bg-primary/10 text-primary border-primary/20" },
  buyer: { label: "Comprador", icon: ShoppingCart, className: "bg-warning/10 text-warning border-warning/20" },
};

const ITEMS_PER_PAGE = 15;

interface UserData {
  id: string;
  name: string;
  joined: string;
  role: string;
  custom_fee_percentage: number | null;
  custom_fee_fixed: number | null;
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [feePercentage, setFeePercentage] = useState("");
  const [feeFixed, setFeeFixed] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, created_at, custom_fee_percentage, custom_fee_fixed")
        .order("created_at", { ascending: false });

      if (!profiles) return [];

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
        const role = userRoles.includes("admin") ? "admin" : userRoles.includes("producer") ? "producer" : "buyer";
        return {
          id: p.user_id,
          name: p.display_name || "Sem nome",
          joined: format(new Date(p.created_at), "dd/MM/yyyy"),
          role,
          custom_fee_percentage: p.custom_fee_percentage,
          custom_fee_fixed: p.custom_fee_fixed,
        } as UserData;
      });
    },
  });

  const filtered = useMemo(() => {
    let result = users;
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((u) => u.name.toLowerCase().includes(q));
    }
    return result;
  }, [users, roleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleRoleFilter = (v: string) => { setRoleFilter(v); setPage(1); };

  const openFeeDialog = (user: UserData) => {
    setEditingUser(user);
    setFeePercentage(user.custom_fee_percentage != null ? String(user.custom_fee_percentage) : "");
    setFeeFixed(user.custom_fee_fixed != null ? (user.custom_fee_fixed / 100).toFixed(2) : "");
  };

  const handleSaveFees = async () => {
    if (!editingUser) return;
    setSavingFee(true);

    const customPercentage = feePercentage.trim() === "" ? null : parseFloat(feePercentage);
    const customFixed = feeFixed.trim() === "" ? null : Math.round(parseFloat(feeFixed) * 100);

    const { error } = await supabase
      .from("profiles")
      .update({
        custom_fee_percentage: customPercentage,
        custom_fee_fixed: customFixed,
      } as any)
      .eq("user_id", editingUser.id);

    if (error) {
      toast.error("Erro ao salvar taxas.");
    } else {
      toast.success("Taxas atualizadas!");
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      setEditingUser(null);
    }
    setSavingFee(false);
  };

  const handleResetToDefault = async () => {
    if (!editingUser) return;
    setSavingFee(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        custom_fee_percentage: null,
        custom_fee_fixed: null,
      } as any)
      .eq("user_id", editingUser.id);

    if (error) {
      toast.error("Erro ao resetar taxas.");
    } else {
      toast.success("Taxas restauradas para o padrão!");
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      setEditingUser(null);
    }
    setSavingFee(false);
  };

  const getFeeLabel = (user: UserData) => {
    if (user.custom_fee_percentage != null || user.custom_fee_fixed != null) {
      const pct = user.custom_fee_percentage ?? 3.89;
      const fixed = user.custom_fee_fixed != null ? (user.custom_fee_fixed / 100) : 2.49;
      return `${pct}% + R$${fixed.toFixed(2)}`;
    }
    return "Padrão";
  };

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={roleFilter} onValueChange={handleRoleFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Todas as funções" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funções</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="producer">Produtor</SelectItem>
            <SelectItem value="buyer">Comprador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_80px_80px_50px] gap-4 px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <span>Nome</span>
          <span>Função</span>
          <span>Taxa</span>
          <span>Cadastro</span>
          <span></span>
        </div>
        {paginated.map((user, i) => {
          const rc = roleConfig[user.role as keyof typeof roleConfig] || roleConfig.buyer;
          const hasCustomFee = user.custom_fee_percentage != null || user.custom_fee_fixed != null;
          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="grid grid-cols-[1fr_100px_80px_80px_50px] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <span className="text-sm font-medium truncate">{user.name}</span>
              <Badge variant="outline" className={`text-[0.65rem] w-fit gap-1 ${rc.className}`}>
                <rc.icon className="h-3 w-3" strokeWidth={1.5} />
                {rc.label}
              </Badge>
              <span className={`text-xs truncate ${hasCustomFee ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {getFeeLabel(user)}
              </span>
              <span className="text-xs text-muted-foreground">{user.joined}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-sm" onClick={() => openFeeDialog(user)}>
                    <Percent className="h-3.5 w-3.5 mr-2" />
                    Editar Taxas
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-sm">Ver perfil</DropdownMenuItem>
                  <DropdownMenuItem className="text-sm text-destructive">Suspender</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          );
        })}
        {paginated.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            Mostrando {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Fee Editing Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Editar Taxas — {editingUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Taxas padrão: <strong>3,89% + R$ 2,49</strong> por venda com cartão. Deixe em branco para usar o padrão.
            </p>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Taxa percentual (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={feePercentage}
                onChange={(e) => setFeePercentage(e.target.value)}
                placeholder="3.89 (padrão)"
                className="bg-muted/50 border-transparent focus:border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Taxa fixa por transação (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={feeFixed}
                onChange={(e) => setFeeFixed(e.target.value)}
                placeholder="2.49 (padrão)"
                className="bg-muted/50 border-transparent focus:border-border"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={handleResetToDefault} disabled={savingFee}>
              Restaurar Padrão
            </Button>
            <Button size="sm" onClick={handleSaveFees} disabled={savingFee}>
              {savingFee ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Taxas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
