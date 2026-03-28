import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Mail, CheckCircle, XCircle, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TimeRange = "24h" | "7d" | "30d" | "all";

export default function AdminCartRecovery() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const getStartDate = (range: TimeRange) => {
    const now = new Date();
    switch (range) {
      case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case "all": return new Date(0).toISOString();
    }
  };

  // Fetch abandoned carts (all pending_payments that were notified)
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

  // Fetch all pending payments for total abandoned count
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

  // Fetch recovery emails from email_send_log
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

  // Fetch product titles
  const productIds = [...new Set(notifiedCarts.map(c => c.product_id))];
  const { data: products = [] } = useQuery({
    queryKey: ["admin-cart-recovery-products", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const { data } = await supabase
        .from("products")
        .select("id, title")
        .in("id", productIds);
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p.title])), [products]);

  // Deduplicate emails by message_id (latest status)
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

  // Metrics
  const totalAbandoned = allAbandoned.filter(p => p.status === "pending").length;
  const totalNotified = notifiedCarts.length;
  const emailsSent = uniqueEmails.filter(e => e.status === "sent").length;
  const emailsFailed = uniqueEmails.filter(e => e.status === "dlq" || e.status === "failed").length;
  const recovered = notifiedCarts.filter(c => c.status === "confirmed" || c.status === "paid").length;
  const conversionRate = totalNotified > 0 ? ((recovered / totalNotified) * 100).toFixed(1) : "0.0";

  const timeRangeOptions: { label: string; value: TimeRange }[] = [
    { label: "24h", value: "24h" },
    { label: "7 dias", value: "7d" },
    { label: "30 dias", value: "30d" },
    { label: "Tudo", value: "all" },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enviado</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-500/30">Pendente</Badge>;
      case "confirmed":
      case "paid":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Recuperado</Badge>;
      case "dlq":
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recuperação de Carrinho</h1>
          <p className="text-sm text-muted-foreground">Métricas de carrinhos abandonados e emails de recuperação</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {timeRangeOptions.map(opt => (
            <Button
              key={opt.value}
              variant={timeRange === opt.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(opt.value)}
              className="text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Abandonados</span>
            </div>
            <p className="text-2xl font-bold">{totalAbandoned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Notificados</span>
            </div>
            <p className="text-2xl font-bold">{totalNotified}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Emails Enviados</span>
            </div>
            <p className="text-2xl font-bold">{emailsSent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Falhas</span>
            </div>
            <p className="text-2xl font-bold">{emailsFailed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Recuperados</span>
            </div>
            <p className="text-2xl font-bold">{recovered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Conversão</span>
            </div>
            <p className="text-2xl font-bold">{conversionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Notified Carts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carrinhos Notificados</CardTitle>
        </CardHeader>
        <CardContent>
          {notifiedCarts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum carrinho notificado no período selecionado</p>
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
                    <TableHead>Notificado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifiedCarts.map(cart => (
                    <TableRow key={cart.id}>
                      <TableCell className="font-medium">{cart.buyer_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cart.buyer_email || "—"}</TableCell>
                      <TableCell className="text-sm">{productMap.get(cart.product_id) || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        R$ {(cart.amount / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>{statusBadge(cart.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cart.recovery_notified_at
                          ? format(new Date(cart.recovery_notified_at), "dd/MM HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}