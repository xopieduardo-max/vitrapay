import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Package, ShoppingBag, Landmark, Percent, Loader2,
  Calendar, Eye, TrendingUp, DollarSign, Pencil, RotateCcw, Users,
  Mail, Phone, MapPin, CreditCard, IdCard, CheckCircle2, XCircle, Cake,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const [selectedPlan, setSelectedPlan] = useState<string>("d2");

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

  // Email (from auth.users via secure RPC)
  const { data: userEmail } = useQuery({
    queryKey: ["admin-user-email", userId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_emails");
      const row = (data || []).find((e: any) => e.user_id === userId);
      return row?.email as string | undefined;
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

  // Save custom fees and plan
  const saveCustomFees = useMutation({
    mutationFn: async ({ pct, fixed, plan }: { pct: number | null; fixed: number | null; plan: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ custom_fee_percentage: pct, custom_fee_fixed: fixed, card_plan: plan })
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
    setSelectedPlan(profile?.card_plan || "d30");
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
    saveCustomFees.mutate({ pct, fixed, plan: selectedPlan });
  };

  const handleResetFees = () => {
    saveCustomFees.mutate({ pct: null, fixed: null, plan: selectedPlan });
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
        <Avatar className="h-12 w-12 border border-border">
          <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name || ""} />
          <AvatarFallback className="text-sm">
            {(profile.display_name || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {profile.display_name || "Sem nome"}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {roles.map((r) => (
              <Badge key={r} variant="outline" className="text-xs">
                {roleLabels[r] || r}
              </Badge>
            ))}
            {profile.is_suspended && (
              <Badge variant="outline" className="text-xs border-red-500/50 text-red-500 bg-red-500/10">
                Suspenso
              </Badge>
            )}
            {profile.profile_verified && (
              <Badge variant="outline" className="text-xs border-green-500/50 text-green-500 bg-green-500/10 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Verificado
              </Badge>
            )}
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

      {/* Personal info / cadastro completo */}
      {(() => {
        const addrParts = [
          profile.address_street,
          profile.address_number,
          profile.address_neighborhood,
          profile.address_city && profile.address_state
            ? `${profile.address_city}/${profile.address_state}`
            : profile.address_city || profile.address_state,
          profile.address_cep,
        ].filter(Boolean);
        const fullAddress = addrParts.length ? addrParts.join(", ") : null;

        // Critérios pra saque: precisa CPF, telefone, PIX e endereço básico preenchidos
        const checks = [
          { label: "Nome", ok: !!profile.display_name?.trim() },
          { label: "E-mail", ok: !!userEmail },
          { label: "CPF/CNPJ", ok: !!profile.cpf?.trim() },
          { label: "Telefone", ok: !!profile.phone?.trim() },
          { label: "Chave PIX", ok: !!profile.pix_key?.trim() },
          { label: "Endereço", ok: !!(profile.address_cep && profile.address_city && profile.address_state) },
        ];
        const completeForWithdraw = checks.every((c) => c.ok);

        const Item = ({
          icon: Icon,
          label,
          value,
        }: {
          icon: any;
          label: string;
          value: React.ReactNode;
        }) => (
          <div className="flex items-start gap-2">
            <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="text-sm font-medium break-words">{value || <span className="text-muted-foreground italic">não informado</span>}</p>
            </div>
          </div>
        );

        return (
          <Card className="border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <IdCard className="h-4 w-4" strokeWidth={1.5} />
                Cadastro do usuário
              </CardTitle>
              <Badge
                variant="outline"
                className={`text-xs gap-1 ${
                  completeForWithdraw
                    ? "border-green-500/50 text-green-500 bg-green-500/10"
                    : "border-yellow-500/50 text-yellow-500 bg-yellow-500/10"
                }`}
              >
                {completeForWithdraw ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Cadastro completo — pode sacar
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" /> Cadastro incompleto — saque bloqueado
                  </>
                )}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Item
                  icon={Mail}
                  label="E-mail"
                  value={userEmail ? (
                    <a href={`mailto:${userEmail}`} className="hover:text-primary transition-colors">
                      {userEmail}
                    </a>
                  ) : null}
                />
                <Item
                  icon={Phone}
                  label="Telefone"
                  value={profile.phone ? (() => {
                    const digits = String(profile.phone).replace(/\D/g, "");
                    const wa = digits.length >= 10 ? (digits.startsWith("55") ? digits : `55${digits}`) : null;
                    return wa ? (
                      <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-green-500 transition-colors"
                      >
                        {profile.phone}
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-green-500" aria-hidden="true">
                          <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                        </svg>
                      </a>
                    ) : profile.phone;
                  })() : null}
                />
                <Item icon={IdCard} label="CPF / CNPJ" value={profile.cpf} />
                <Item
                  icon={Cake}
                  label="Nascimento"
                  value={profile.birth_date ? format(new Date(profile.birth_date), "dd/MM/yyyy") : null}
                />
                <Item
                  icon={CreditCard}
                  label={`Chave PIX${profile.pix_key_type ? ` (${profile.pix_key_type})` : ""}`}
                  value={profile.pix_key}
                />
                <Item icon={MapPin} label="Endereço" value={fullAddress} />
              </div>

              {!completeForWithdraw && (
                <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs">
                  <p className="font-medium text-yellow-600 mb-1">Itens pendentes no cadastro:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    {checks.filter((c) => !c.ok).map((c) => (
                      <li key={c.label}>{c.label}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-muted-foreground">
                    O usuário consegue vender normalmente, mas só poderá <strong>solicitar saque</strong> após completar todos os campos.
                  </p>
                </div>
              )}

              {profile.bio && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground mb-1">Bio</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Quick actions + internal notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminQuickActions userId={userId!} userEmail={userEmail} userPhone={profile.phone} />
        <AdminInternalNotes userId={userId!} />
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
      {(() => {
        const plan = profile.card_plan || "d30";
        const planLabel = plan === "d30" ? "D+30 Padrão" : "D+2 Antecipação";
        const planPct = plan === "d30" ? 3.99 : 4.99;
        const planFixed = 2.49;
        const hasCustom = profile.custom_fee_percentage != null || profile.custom_fee_fixed != null;
        const activePct = hasCustom ? (profile.custom_fee_percentage ?? planPct) : planPct;
        const activeFixed = hasCustom ? ((profile.custom_fee_fixed ?? Math.round(planFixed * 100)) / 100) : planFixed;

        return (
          <Card className="border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4" strokeWidth={1.5} />
                Taxas VitraPay
              </CardTitle>
              <div className="flex gap-2">
                {hasCustom && (
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
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className="text-xs">{planLabel}</Badge>
                  {hasCustom && <Badge variant="outline" className="text-xs border-primary/30 text-primary">Taxa personalizada</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Taxa ativa: <strong>{activePct}% + R$ {activeFixed.toFixed(2)}</strong> (Cartão)
                </p>
                {hasCustom && (
                  <p className="text-xs text-muted-foreground">
                    🎯 Este usuário possui taxa diferenciada que sobrepõe o plano padrão.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Fee Dialog */}
      <Dialog open={feeDialogOpen} onOpenChange={setFeeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Taxas — {profile.display_name || "Usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Plan selection */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Plano de recebimento</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "d30", label: "D+30 Padrão", pct: "3,99%", fixed: "R$ 2,49", desc: "Recebe em 30 dias" },
                  { id: "d2", label: "D+2 Antecipação", pct: "4,99%", fixed: "R$ 2,49", desc: "Recebe em 2 dias" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlan(p.id)}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      selectedPlan === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                    <p className="text-sm font-bold mt-2 text-primary">{p.pct} + {p.fixed}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom fee override */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Taxa personalizada (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Deixe em branco para usar a taxa do plano selecionado. Preencha para aplicar uma taxa diferenciada.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Porcentagem (%)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder={selectedPlan === "d30" ? "3.99" : "4.99"}
                    value={customPct}
                    onChange={(e) => setCustomPct(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor fixo (R$)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="2.49"
                    value={customFixed}
                    onChange={(e) => setCustomFixed(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Simulation */}
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              💡 Exemplo: Venda de R$ 100 → VitraPay recebe R$ {(() => {
                const basePct = selectedPlan === "d30" ? 3.99 : 4.99;
                const baseFix = 2.49;
                const pct = customPct.trim() ? parseFloat(customPct.replace(",", ".")) : basePct;
                const fix = customFixed.trim() ? parseFloat(customFixed.replace(",", ".")) : baseFix;
                if (isNaN(pct) || isNaN(fix)) return "—";
                return ((100 * pct / 100) + fix).toFixed(2);
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFeeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveFees} disabled={saveCustomFees.isPending}>
              {saveCustomFees.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
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
                    onClick={() => navigate(`/admin/product/${p.id}`)}
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
