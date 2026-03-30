import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { ShoppingCart, Mail, CheckCircle, XCircle, TrendingUp, Clock, RefreshCw, MessageCircle, Settings2, BarChart3, Save } from "lucide-react";
import { format, eachDayOfInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type TimeRange = "24h" | "7d" | "30d" | "all";

export default function AdminCartRecovery() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const queryClient = useQueryClient();

  const getStartDate = (range: TimeRange) => {
    const now = new Date();
    switch (range) {
      case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case "all": return new Date(0).toISOString();
    }
  };

  // ─── Recovery Settings ───
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["cart-recovery-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_recovery_settings" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [localSettings, setLocalSettings] = useState<any>(null);
  const effectiveSettings = localSettings || settings;

  // Sync when settings load
  if (settings && !localSettings) {
    // Use setTimeout to avoid setState during render
    setTimeout(() => setLocalSettings({ ...settings }), 0);
  }

  const updateField = (field: string, value: any) => {
    setLocalSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!localSettings) return;
      const { id, ...rest } = localSettings;
      const { error } = await supabase
        .from("cart_recovery_settings" as any)
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas!");
      queryClient.invalidateQueries({ queryKey: ["cart-recovery-settings"] });
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  // ─── Data Queries ───
  const { data: notifiedCarts = [] } = useQuery({
    queryKey: ["admin-cart-recovery-notified", timeRange],
    queryFn: async () => {
      const startDate = getStartDate(timeRange);
      const { data, error } = await supabase
        .from("pending_payments")
        .select("id, buyer_name, buyer_email, product_id, amount, status, created_at, recovery_notified_at, recovery_second_notified_at")
        .not("recovery_notified_at", "is", null)
        .gte("created_at", startDate)
        .order("recovery_notified_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allAbandoned = [] } = useQuery({
    queryKey: ["admin-cart-recovery-all", timeRange],
    queryFn: async () => {
      const startDate = getStartDate(timeRange);
      const { data, error } = await supabase
        .from("pending_payments")
        .select("id, status, created_at, recovery_notified_at")
        .gte("created_at", startDate)
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recoveryEmails = [] } = useQuery({
    queryKey: ["admin-cart-recovery-emails", timeRange],
    queryFn: async () => {
      const startDate = getStartDate(timeRange);
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, message_id, recipient_email, status, created_at, template_name")
        .in("template_name", ["cart_recovery", "cart_recovery_2"])
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const productIds = [...new Set(notifiedCarts.map(c => c.product_id))];
  const { data: products = [] } = useQuery({
    queryKey: ["admin-cart-recovery-products", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const { data } = await supabase.from("products").select("id, title").in("id", productIds);
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p.title])), [products]);

  const uniqueEmails = useMemo(() => {
    const map = new Map<string, typeof recoveryEmails[0]>();
    for (const e of recoveryEmails) {
      const key = e.message_id || e.id;
      const existing = map.get(key);
      if (!existing || new Date(e.created_at) > new Date(existing.created_at)) {
        map.set(key, e);
      }
    }
    return Array.from(map.values());
  }, [recoveryEmails]);

  // ─── Metrics ───
  const totalAbandoned = allAbandoned.filter(p => p.status === "pending").length;
  const totalNotified = notifiedCarts.length;
  const firstEmails = uniqueEmails.filter(e => e.template_name === "cart_recovery");
  const secondEmails = uniqueEmails.filter(e => e.template_name === "cart_recovery_2");
  const emailsSent = uniqueEmails.filter(e => e.status === "sent").length;
  const emailsFailed = uniqueEmails.filter(e => e.status === "dlq" || e.status === "failed").length;
  const recovered = notifiedCarts.filter(c => c.status === "confirmed" || c.status === "paid").length;
  const conversionRate = totalNotified > 0 ? ((recovered / totalNotified) * 100).toFixed(1) : "0.0";

  // ─── Chart ───
  const chartData = useMemo(() => {
    const startDate = new Date(getStartDate(timeRange));
    const endDate = new Date();
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const abandoned = allAbandoned.filter(p => {
        const d = new Date(p.created_at);
        return d >= dayStart && d < dayEnd && p.status === "pending";
      }).length;
      const recoveredDay = notifiedCarts.filter(c => {
        const d = new Date(c.created_at);
        return d >= dayStart && d < dayEnd && (c.status === "confirmed" || c.status === "paid");
      }).length;
      const notifiedDay = notifiedCarts.filter(c => {
        if (!c.recovery_notified_at) return false;
        const d = new Date(c.recovery_notified_at);
        return d >= dayStart && d < dayEnd;
      }).length;
      return {
        date: format(day, "yyyy-MM-dd"),
        label: format(day, "dd/MM", { locale: ptBR }),
        abandonados: abandoned,
        notificados: notifiedDay,
        recuperados: recoveredDay,
      };
    });
  }, [allAbandoned, notifiedCarts, timeRange]);

  const chartConfig = {
    abandonados: { label: "Abandonados", color: "hsl(var(--destructive))" },
    notificados: { label: "Notificados", color: "hsl(var(--muted-foreground))" },
    recuperados: { label: "Recuperados", color: "hsl(var(--primary))" },
  };

  const timeRangeOptions: { label: string; value: TimeRange }[] = [
    { label: "24h", value: "24h" },
    { label: "7 dias", value: "7d" },
    { label: "30 dias", value: "30d" },
    { label: "Tudo", value: "all" },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enviado</Badge>;
      case "pending": return <Badge variant="outline" className="text-amber-600 border-amber-500/30">Pendente</Badge>;
      case "confirmed": case "paid": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Recuperado</Badge>;
      case "dlq": case "failed": return <Badge variant="destructive">Falhou</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const messagePreview = (template: string, isSecond: boolean) => {
    if (!template) return "";
    return template
      .replace(/{nome}/g, "João Silva")
      .replace(/{produto}/g, "Curso de Marketing")
      .replace(/{link}/g, "https://vitrapay.com.br/checkout/xxx");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recuperação de Carrinho</h1>
          <p className="text-sm text-muted-foreground">Configure mensagens, timing e acompanhe conversões</p>
        </div>
      </div>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB: MÉTRICAS ═══ */}
        <TabsContent value="metrics" className="space-y-6">
          <div className="flex justify-end">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {timeRangeOptions.map(opt => (
                <Button key={opt.value} variant={timeRange === opt.value ? "default" : "ghost"} size="sm" onClick={() => setTimeRange(opt.value)} className="text-xs">
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><ShoppingCart className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Abandonados</span></div><p className="text-2xl font-bold">{totalAbandoned}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">1º Lembrete</span></div><p className="text-2xl font-bold">{firstEmails.filter(e => e.status === "sent").length}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><RefreshCw className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">2º Lembrete</span></div><p className="text-2xl font-bold">{secondEmails.filter(e => e.status === "sent").length}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Emails</span></div><p className="text-2xl font-bold">{emailsSent}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><MessageCircle className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">WhatsApp</span></div><p className="text-2xl font-bold">—</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Recuperados</span></div><p className="text-2xl font-bold">{recovered}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Conversão</span></div><p className="text-2xl font-bold">{conversionRate}%</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Evolução Diária</CardTitle></CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
              ) : (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="abandonados" stroke="var(--color-abandonados)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="notificados" stroke="var(--color-notificados)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="recuperados" stroke="var(--color-recuperados)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Carrinhos Notificados</CardTitle></CardHeader>
            <CardContent>
              {notifiedCarts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum carrinho notificado no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Comprador</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Notificado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notifiedCarts.map(cart => {
                        const c = cart as any;
                        const channels: string[] = [];
                        if (c.recovery_notified_at) channels.push("📧");
                        if (c.whatsapp_notified_at) channels.push("📱");
                        return (
                          <TableRow key={cart.id}>
                            <TableCell className="font-medium">{cart.buyer_name || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{cart.buyer_email || "—"}</TableCell>
                            <TableCell className="text-sm">{productMap.get(cart.product_id) || "—"}</TableCell>
                            <TableCell className="text-right font-mono text-sm">R$ {(cart.amount / 100).toFixed(2)}</TableCell>
                            <TableCell>{statusBadge(cart.status)}</TableCell>
                            <TableCell className="text-lg">{channels.join(" ") || "📧"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {cart.recovery_notified_at ? format(new Date(cart.recovery_notified_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: MENSAGENS ═══ */}
        <TabsContent value="messages" className="space-y-6">
          {loadingSettings || !effectiveSettings ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-emerald-500" />
                    1º Lembrete WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Use <code className="bg-muted px-1 rounded text-xs">{"{nome}"}</code>, <code className="bg-muted px-1 rounded text-xs">{"{produto}"}</code> e <code className="bg-muted px-1 rounded text-xs">{"{link}"}</code> como variáveis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={effectiveSettings.whatsapp_first_message || ""}
                    onChange={(e) => updateField("whatsapp_first_message", e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-2">Pré-visualização:</p>
                    <pre className="text-sm text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap font-sans">
                      {messagePreview(effectiveSettings.whatsapp_first_message || "", false)}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-orange-500" />
                    2º Lembrete WhatsApp (Última Chance)
                  </CardTitle>
                  <CardDescription>
                    Enviado {effectiveSettings.second_delay_hours || 6}h após o primeiro lembrete
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={effectiveSettings.whatsapp_second_message || ""}
                    onChange={(e) => updateField("whatsapp_second_message", e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-orange-700 dark:text-orange-400 font-medium mb-2">Pré-visualização:</p>
                    <pre className="text-sm text-orange-900 dark:text-orange-200 whitespace-pre-wrap font-sans">
                      {messagePreview(effectiveSettings.whatsapp_second_message || "", true)}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Imagem (opcional)</CardTitle>
                  <CardDescription>URL de uma imagem para enviar junto com a mensagem do WhatsApp</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="https://exemplo.com/imagem.png"
                    value={effectiveSettings.whatsapp_image_url || ""}
                    onChange={(e) => updateField("whatsapp_image_url", e.target.value)}
                  />
                  {effectiveSettings.whatsapp_image_url && (
                    <div className="mt-3">
                      <img src={effectiveSettings.whatsapp_image_url} alt="Preview" className="max-h-32 rounded-lg border" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {saveSettings.isPending ? "Salvando..." : "Salvar Mensagens"}
              </Button>
            </>
          )}
        </TabsContent>

        {/* ═══ TAB: CONFIGURAÇÕES ═══ */}
        <TabsContent value="settings" className="space-y-6">
          {loadingSettings || !effectiveSettings ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Canais de Recuperação</CardTitle>
                  <CardDescription>Ative ou desative canais de notificação</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">📧 Email</Label>
                      <p className="text-xs text-muted-foreground">Enviar emails de recuperação</p>
                    </div>
                    <Switch checked={effectiveSettings.email_enabled} onCheckedChange={(v) => updateField("email_enabled", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">📱 WhatsApp</Label>
                      <p className="text-xs text-muted-foreground">Enviar mensagens via WhatsApp</p>
                    </div>
                    <Switch checked={effectiveSettings.whatsapp_enabled} onCheckedChange={(v) => updateField("whatsapp_enabled", v)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Timing</CardTitle>
                  <CardDescription>Configure quando enviar cada lembrete</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">1º Lembrete (minutos após checkout)</Label>
                      <Input
                        type="number"
                        min={5}
                        max={1440}
                        value={effectiveSettings.first_delay_minutes || 30}
                        onChange={(e) => updateField("first_delay_minutes", parseInt(e.target.value) || 30)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">2º Lembrete (horas após 1º)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={48}
                        value={effectiveSettings.second_delay_hours || 6}
                        onChange={(e) => updateField("second_delay_hours", parseInt(e.target.value) || 6)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Expiração máxima (horas)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={72}
                        value={effectiveSettings.max_age_hours || 23}
                        onChange={(e) => updateField("max_age_hours", parseInt(e.target.value) || 23)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {saveSettings.isPending ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
