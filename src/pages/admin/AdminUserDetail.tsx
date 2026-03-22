import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Package, ShoppingBag, Landmark, Percent, Loader2,
  Calendar, Eye, TrendingUp, DollarSign, Pencil, RotateCcw,
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
  const [period, setPeriod] = useState<Period>("30d");

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
        .select("id, title, price, type, is_published, created_at, cover_url")
        .eq("producer_id", userId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!userId,
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

  // Filter sales by period
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
      {(profile.custom_fee_percentage != null || profile.custom_fee_fixed != null) && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          <span>
            Taxa personalizada: <strong>
              {profile.custom_fee_percentage ?? 3.89}% + R$ {((profile.custom_fee_fixed ?? 249) / 100).toFixed(2)}
            </strong>
          </span>
        </div>
      )}

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
                    onClick={() => navigate(`/product/${p.id}`)}
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
