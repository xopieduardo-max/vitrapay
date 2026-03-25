import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Package, ShoppingBag, Landmark, Percent, Loader2,
  Calendar, Eye, TrendingUp, DollarSign, Pencil, RotateCcw, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Period = "7d" | "30d" | "90d" | "all";

function getDateRange(period: Period): Date | null {
  if (period === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - (period === "7d" ? 7 : period === "30d" ? 30 : 90));
  return d;
}

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("30d");
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [customPct, setCustomPct] = useState("");
  const [customFixed, setCustomFixed] = useState("");

  // Profile
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["admin-user-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  // Roles
  const { data: roles = [] } = useQuery({
    queryKey: ["admin-user-roles", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      return (data || []).map((r: any) => r.role as string);
    },
    enabled: !!userId,
  });

  // Products
  const { data: products = [] } = useQuery({
    queryKey: ["admin-user-products", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, title, price, type, is_published, created_at, cover_url, file_url")
        .eq("producer_id", userId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  // Product access counts
  const { data: accessCounts = {} } = useQuery({
    queryKey: ["admin-user-product-access", userId, products],
    queryFn: async () => {
      if (!products.length) return {};
      const productIds = products.map((p) => p.id);
      const { data } = await supabase
        .from("product_access")
        .select("product_id")
        .in("product_id", productIds);
      const counts: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        counts[a.product_id] = (counts[a.product_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!userId && products.length > 0,
  });

  // Sales
  const { data: sales = [] } = useQuery({
    queryKey: ["admin-user-sales", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, amount, platform_fee, status, created_at, product_id")
        .eq("producer_id", userId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  // Platform default fees
  const { data: platformFees } = useQuery({
    queryKey: ["platform-fees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_fees")
        .select("*")
        .eq("id", 1)
        .single();
      return data;
    },
  });

  // Save custom fees
  const saveCustomFees = useMutation({
    mutationFn: async ({ pct, fixed }: { pct: number | null; fixed: number | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ custom_fee_percentage: pct, custom_fee_fixed: fixed })
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-profile", userId] });
      toast.success("Taxas atualizadas com sucesso!");
      setFeeDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar taxas"),
  });

  const openFeeDialog = () => {
    setCustomPct(profile?.custom_fee_percentage != null ? String(profile.custom_fee_percentage) : "");
    setCustomFixed(profile?.custom_fee_fixed != null ? String((profile.custom_fee_fixed / 100).toFixed(2)) : "");
    setFeeDialogOpen(true);
  };

  const handleSaveFees = () => {
    const pct = customPct.trim() === "" ? null : parseFloat(customPct.replace(",", "."));
    const fixed = customFixed.trim() === "" ? null : Math.round(parseFloat(customFixed.replace(",", ".")) * 100);
    if (pct !== null && (isNaN(pct) || pct < 0 || pct > 100)) {
      toast.error("Porcentagem inválida (0-100)");
      return;
    }
    if (fixed !== null && (isNaN(fixed) || fixed < 0)) {
      toast.error("Valor fixo inválido");
      return;
    }
    saveCustomFees.mutate({ pct, fixed });
  };

  const handleResetFees = () => {
    saveCustomFees.mutate({ pct: null, fixed: null });
  };

  const filteredSales = useMemo(() => {
    const from = getDateRange(period);
    if (!from) return sales;
    return sales.filter((s) => new Date(s.created_at) >= from);
  }, [sales, period]);

  // Metrics
  const metrics = useMemo(() => {
    const completed = filteredSales.filter((s) => s.status === "completed");
    const totalRevenue = completed.reduce((a, s) => a + s.amount, 0);
    const totalFees = completed.reduce((a, s) => a + (s.platform_fee || 0), 0);
    const netRevenue = totalRevenue - totalFees;
    return {
      totalSales: completed.length,
      totalRevenue,
      totalFees,
      netRevenue,
      pendingSales: filteredSales.filter((s) => s.status === "pending").length,
    };
  }, [filteredSales]);

  // Sales per product
  const salesByProduct = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; fees: number }> = {};
    filteredSales
      .filter((s) => s.status === "completed")
      .forEach((s) => {
        const pid = s.product_id || "unknown";
        if (!map[pid]) map[pid] = { count: 0, revenue: 0, fees: 0 };
        map[pid].count++;
        map[pid].revenue += s.amount;
        map[pid].fees += s.platform_fee || 0;
      });
    return map;
  }, [filteredSales]);

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Usuário não encontrado.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    producer: "Produtor",
    buyer: "Comprador",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {profile.display_name || "Sem nome"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {roles.map((r) => (
              <Badge key={r} variant="outline" className="text-xs">
                {roleLabels[r] || r}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground">
              Cadastrado em {format(new Date(profile.created_at), "dd/MM/yyyy")}
            </span>
          </div>
        </div>
        {/* Period filter */}
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
            <SelectItem value="90d">90 dias</SelectItem>
            <SelectItem value="all">Todo período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Onboarding survey info */}
      {profile.onboarding_completed && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Perfil de Cadastro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {profile.account_type && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Tipo</p>
                  <p className="font-medium">{profile.account_type === "producer" ? "Produtor" : "Comprador"}</p>
                </div>
              )}
              {profile.already_sells !== null && profile.already_sells !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Já vendia?</p>
                  <p className="font-medium">{profile.already_sells ? "Sim" : "Não"}</p>
                </div>
              )}
              {profile.monthly_revenue && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Faturamento</p>
                  <p className="font-medium">{profile.monthly_revenue}</p>
                </div>
              )}
              {profile.current_platform && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Plataforma anterior</p>
                  <p className="font-medium">{profile.current_platform}</p>
                </div>
              )}
              {profile.referral_source && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Como conheceu</p>
                  <p className="font-medium">{profile.referral_source}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fee info */}
      <Card className="border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4" strokeWidth={1.5} />
            Taxas VitraPay
          </CardTitle>
          <div className="flex gap-2">
            {(profile.custom_fee_percentage != null || profile.custom_fee_fixed != null) && (
              <Button variant="ghost" size="sm" onClick={handleResetFees} disabled={saveCustomFees.isPending}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resetar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openFeeDialog}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar Taxas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profile.custom_fee_percentage != null || profile.custom_fee_fixed != null ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex items-center gap-2">
                <span>
                  🎯 Taxa personalizada: <strong>
                    {profile.custom_fee_percentage ?? (platformFees?.card_percentage ?? 3.89)}% + R$ {((profile.custom_fee_fixed ?? (platformFees?.card_fixed ?? 249)) / 100).toFixed(2)}
                  </strong>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Este usuário possui taxa diferenciada que sobrepõe a taxa padrão da plataforma.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Usando taxas padrão da plataforma: <strong>{platformFees?.card_percentage ?? 3.89}% + R$ {((platformFees?.card_fixed ?? 249) / 100).toFixed(2)}</strong> (Cartão)
                {platformFees && (Number(platformFees.pix_percentage) > 0 || platformFees.pix_fixed > 0) && (
                  <> · <strong>{platformFees.pix_percentage}% + R$ {(platformFees.pix_fixed / 100).toFixed(2)}</strong> (Pix)</>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Clique em "Editar Taxas" para definir uma taxa personalizada para este usuário.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fee Dialog */}
      <Dialog open={feeDialogOpen} onOpenChange={setFeeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Taxas VitraPay — {profile.display_name || "Usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Defina taxas personalizadas para este produtor. Deixe em branco para usar as taxas padrão da plataforma
              ({platformFees?.card_percentage ?? 3.89}% + R$ {((platformFees?.card_fixed ?? 249) / 100).toFixed(2)}).
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Porcentagem (%)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={String(platformFees?.card_percentage ?? 3.89)}
                  value={customPct}
                  onChange={(e) => setCustomPct(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor fixo (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={((platformFees?.card_fixed ?? 249) / 100).toFixed(2)}
                  value={customFixed}
                  onChange={(e) => setCustomFixed(e.target.value)}
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              💡 Exemplo: Se o produtor vender R$ 100 com taxa de {customPct || String(platformFees?.card_percentage ?? 3.89)}% + R$ {customFixed || ((platformFees?.card_fixed ?? 249) / 100).toFixed(2)}, 
              a VitraPay receberá R$ {(() => {
                const pct = parseFloat((customPct || String(platformFees?.card_percentage ?? 3.89)).replace(",", "."));
                const fix = parseFloat((customFixed || ((platformFees?.card_fixed ?? 249) / 100).toFixed(2)).replace(",", "."));
                if (isNaN(pct) || isNaN(fix)) return "—";
                return ((100 * pct / 100) + fix).toFixed(2);
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFeeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveFees} disabled={saveCustomFees.isPending}>
              {saveCustomFees.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Taxas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Vendas", value: metrics.totalSales.toString(), icon: ShoppingBag, color: "text-primary" },
          { label: "Faturamento", value: fmt(metrics.totalRevenue), icon: TrendingUp, color: "text-green-500" },
          { label: "Comissão Plataforma", value: fmt(metrics.totalFees), icon: DollarSign, color: "text-accent" },
          { label: "Líquido Produtor", value: fmt(metrics.netRevenue), icon: Landmark, color: "text-blue-500" },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
          >
            <Card className="border-border">
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">{m.label}</span>
                  <m.icon className={`h-4 w-4 ${m.color}`} strokeWidth={1.5} />
                </div>
                <p className="text-xl font-bold">{m.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Products */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" strokeWidth={1.5} />
            Produtos ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">
              Este usuário ainda não criou produtos.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {products.map((p) => {
                const pSales = salesByProduct[p.id];
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/edit-product/${p.id}`)}
                  >
                    {p.cover_url ? (
                      <img
                        src={p.cover_url}
                        alt={p.title}
                        className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.type === "course" ? "Curso" : "Download"} · {fmt(p.price)}
                        {!p.is_published && " · Rascunho"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground flex-shrink-0">
                      <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span className="text-xs">{accessCounts[p.id] || 0} acesso{(accessCounts[p.id] || 0) !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {pSales ? (
                        <>
                          <p className="text-sm font-semibold">{fmt(pSales.revenue)}</p>
                          <p className="text-xs text-muted-foreground">
                            {pSales.count} venda{pSales.count !== 1 ? "s" : ""}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem vendas</p>
                      )}
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sales */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
            Últimas Vendas ({filteredSales.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredSales.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">
              Nenhuma venda neste período.
            </p>
          ) : (
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {filteredSales.slice(0, 50).map((s) => {
                const prod = products.find((p) => p.id === s.product_id);
                const statusMap: Record<string, { label: string; cls: string }> = {
                  completed: { label: "Pago", cls: "bg-green-500/10 text-green-500 border-green-500/20" },
                  pending: { label: "Pendente", cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
                  refunded: { label: "Reembolsado", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
                };
                const st = statusMap[s.status] || statusMap.pending;
                return (
                  <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {prod?.title || "Produto removido"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[0.65rem] ${st.cls}`}>
                      {st.label}
                    </Badge>
                    <div className="text-right flex-shrink-0 w-24">
                      <p className="text-sm font-semibold">{fmt(s.amount)}</p>
                      <p className="text-[0.65rem] text-muted-foreground">
                        Taxa: {fmt(s.platform_fee || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
