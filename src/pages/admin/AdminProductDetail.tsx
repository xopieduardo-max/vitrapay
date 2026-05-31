import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Package, Download, BookOpen, Image, FileDown, Users,
  TrendingUp, DollarSign, ShoppingCart, Loader2, Eye, ExternalLink,
  EyeOff, Globe, Mail, Phone, AlertCircle, FileSpreadsheet, Copy,
  Target, Sparkles, Search, Crown, BarChart3, GraduationCap, Clock,
} from "lucide-react";
import { downloadFile } from "@/lib/downloadFile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAdminAudit } from "@/hooks/useAdminAudit";
import { exportMetaAudience, exportGoogleAudience, type AudienceContact } from "@/lib/audienceExport";
import { useMemo, useState } from "react";

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function AdminProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logAction } = useAdminAudit();

  // Product info
  const { data: product, isLoading } = useQuery({
    queryKey: ["admin-product-detail", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId!)
        .maybeSingle();
      return data;
    },
    enabled: !!productId,
  });

  // Producer name
  const { data: producer } = useQuery({
    queryKey: ["admin-product-producer", product?.producer_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", product!.producer_id)
        .maybeSingle();
      return data;
    },
    enabled: !!product?.producer_id,
  });

  // Sales data
  const { data: salesData } = useQuery({
    queryKey: ["admin-product-sales", productId],
    queryFn: async () => {
      const { data: sales } = await supabase
        .from("sales")
        .select("amount, platform_fee, status")
        .eq("product_id", productId!);

      const completed = (sales || []).filter((s) => s.status === "completed");
      const totalRevenue = completed.reduce((acc, s) => acc + s.amount, 0);
      const totalFees = completed.reduce((acc, s) => acc + (s.platform_fee || 0), 0);
      const totalSales = (sales || []).length;
      const completedSales = completed.length;

      return { totalRevenue, totalFees, totalSales, completedSales };
    },
    enabled: !!productId,
  });

  // Access count (buyers)
  const { data: accessCount } = useQuery({
    queryKey: ["admin-product-access", productId],
    queryFn: async () => {
      const { count } = await supabase
        .from("product_access")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId!);
      return count || 0;
    },
    enabled: !!productId,
  });

  // Pending payments count (checkout visits proxy)
  const { data: pendingCount } = useQuery({
    queryKey: ["admin-product-pending", productId],
    queryFn: async () => {
      const { count } = await supabase
        .from("pending_payments")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId!);
      return count || 0;
    },
    enabled: !!productId,
  });

  // Buyers (confirmed) — full contact list for custom audiences
  const { data: buyers = [] } = useQuery({
    queryKey: ["admin-product-buyers", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pending_payments")
        .select("buyer_name, buyer_email, buyer_phone, buyer_cpf, buyer_city, buyer_state, amount, created_at, utm_source, utm_campaign")
        .eq("product_id", productId!)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!productId,
  });

  // Abandoned carts (pending / not confirmed)
  const { data: abandoned = [] } = useQuery({
    queryKey: ["admin-product-abandoned", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pending_payments")
        .select("id, buyer_name, buyer_email, buyer_phone, buyer_cpf, amount, status, created_at, utm_source, utm_campaign")
        .eq("product_id", productId!)
        .neq("status", "confirmed")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!productId,
  });

  // Platform-wide total spent per email (aggregated across all products)
  const { data: platformSpentMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["admin-product-platform-spent", productId, buyers.length],
    queryFn: async () => {
      const emails = Array.from(new Set(buyers.map((b: any) => b.buyer_email).filter(Boolean)));
      if (emails.length === 0) return {};
      const { data } = await supabase
        .from("pending_payments")
        .select("buyer_email, amount")
        .in("buyer_email", emails)
        .eq("status", "confirmed");
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[r.buyer_email] = (map[r.buyer_email] || 0) + (r.amount || 0);
      });
      return map;
    },
    enabled: !!productId && buyers.length > 0,
  });

  // Modules & lessons (for courses)
  const { data: modules } = useQuery({
    queryKey: ["admin-product-modules", productId],
    queryFn: async () => {
      const { data: mods } = await supabase
        .from("modules")
        .select("id, title, position")
        .eq("product_id", productId!)
        .order("position");

      if (!mods || mods.length === 0) return [];

      const moduleIds = mods.map((m) => m.id);
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, module_id, position, video_url, duration_minutes")
        .in("module_id", moduleIds)
        .order("position");

      return mods.map((m) => ({
        ...m,
        lessons: (lessons || []).filter((l) => l.module_id === m.id),
      }));
    },
    enabled: !!productId && product?.type === "course",
  });

  const togglePublish = async () => {
    if (!product) return;
    const newState = !product.is_published;
    const { error } = await supabase
      .from("products")
      .update({ is_published: newState })
      .eq("id", product.id);
    if (error) {
      toast.error("Erro ao alterar status do produto.");
    } else {
      toast.success(newState ? "Produto publicado!" : "Produto despublicado.");
      await logAction("product_unpublished", "product", product.id, { title: product.title, is_published: newState });
      queryClient.invalidateQueries({ queryKey: ["admin-product-detail", productId] });
    }
  };

  const conversionRate = (() => {
    const total = (pendingCount || 0) + (salesData?.totalSales || 0);
    if (total === 0) return 0;
    return ((salesData?.completedSales || 0) / total) * 100;
  })();

  const exportCSV = (rows: any[], filename: string, headers: { key: string; label: string }[]) => {
    if (!rows.length) {
      toast.error("Nenhum dado para exportar.");
      return;
    }
    const csv = [
      headers.map((h) => h.label).join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = r[h.key];
            if (v == null) return "";
            const s = String(v).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          })
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado!");
    logAction("data_exported", "product", productId!, { filename, count: rows.length });
  };

  // ===== Públicos personalizados (segmentos prontos) =====
  const [exporting, setExporting] = useState<string | null>(null);

  const segments = useMemo(() => {
    const now = Date.now();
    const buyersAll = buyers as AudienceContact[];

    // Conta compras de cada email na plataforma inteira (já temos platformSpentMap como valor)
    // Contagem usa o array buyers (deste produto) para repetidos no MESMO produto.
    const countByEmail: Record<string, number> = {};
    buyersAll.forEach((b: any) => {
      if (b.buyer_email) countByEmail[b.buyer_email] = (countByEmail[b.buyer_email] || 0) + 1;
    });

    // Top spenders na plataforma (top 25%)
    const spentValues = Object.values(platformSpentMap).sort((a, b) => b - a);
    const cutoffIdx = Math.max(0, Math.floor(spentValues.length * 0.25) - 1);
    const topThreshold = spentValues[cutoffIdx] || 0;

    const recentAbandoned = (abandoned as any[]).filter(
      (a) => now - new Date(a.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
    );

    return [
      {
        id: "all-buyers",
        title: "Todos os compradores",
        description: "Quem já comprou este produto (conversão confirmada).",
        rows: buyersAll,
        tone: "primary" as const,
      },
      {
        id: "vip",
        title: "Clientes VIP",
        description: "Top 25% que mais gastaram na plataforma toda — ideal para upsell premium.",
        rows: buyersAll.filter((b: any) => (platformSpentMap[b.buyer_email] || 0) >= topThreshold && topThreshold > 0),
        tone: "primary" as const,
      },
      {
        id: "repeat",
        title: "Compradores recorrentes",
        description: "Compraram este produto mais de uma vez. Audiência quente.",
        rows: buyersAll.filter((b: any) => (countByEmail[b.buyer_email] || 0) > 1),
        tone: "primary" as const,
      },
      {
        id: "abandoned-all",
        title: "Todos os abandonos",
        description: "Iniciaram o checkout mas não pagaram — público para remarketing.",
        rows: abandoned as AudienceContact[],
        tone: "amber" as const,
      },
      {
        id: "abandoned-recent",
        title: "Abandonos últimos 7 dias",
        description: "Janela quente: lembrança recente do produto.",
        rows: recentAbandoned as AudienceContact[],
        tone: "amber" as const,
      },
    ];
  }, [buyers, abandoned, platformSpentMap]);

  const handleAudienceExport = async (
    platform: "meta" | "google",
    segment: { id: string; title: string; rows: AudienceContact[] }
  ) => {
    if (!segment.rows.length) {
      toast.error("Segmento vazio.");
      return;
    }
    const key = `${platform}-${segment.id}`;
    setExporting(key);
    try {
      const safe = segment.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const filename = `${platform}-${safe}-${product?.title?.slice(0, 30).replace(/[^a-z0-9]+/gi, "-") || "produto"}.csv`;
      if (platform === "meta") {
        await exportMetaAudience(segment.rows, filename);
      } else {
        await exportGoogleAudience(segment.rows, filename);
      }
      toast.success(`${segment.rows.length} contatos exportados para ${platform === "meta" ? "Meta Ads" : "Google Ads"}.`);
      await logAction("data_exported", "product", productId!, {
        kind: "audience",
        platform,
        segment: segment.id,
        count: segment.rows.length,
      });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar arquivo.");
    } finally {
      setExporting(null);
    }
  };

  const copyEmails = (rows: any[]) => {
    const emails = Array.from(new Set(rows.map((r) => r.buyer_email).filter(Boolean)));
    if (!emails.length) {
      toast.error("Nenhum email encontrado.");
      return;
    }
    navigator.clipboard.writeText(emails.join(", "));
    toast.success(`${emails.length} email(s) copiado(s).`);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Package className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Produto não encontrado.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{product.title}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>por {producer?.display_name || "—"}</span>
            <span>·</span>
            <Badge variant={product.is_published ? "default" : "secondary"} className="text-xs">
              {product.is_published ? "Publicado" : "Rascunho"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {product.type === "course" ? "Curso" : "Download"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xl font-bold text-primary">{fmt(product.price)}</p>
          <Button
            size="sm"
            variant={product.is_published ? "outline" : "default"}
            className={`gap-1.5 ${product.is_published ? "text-destructive border-destructive/30 hover:bg-destructive/10" : ""}`}
            onClick={togglePublish}
          >
            {product.is_published ? (
              <><EyeOff className="h-3.5 w-3.5" /> Despublicar</>
            ) : (
              <><Globe className="h-3.5 w-3.5" /> Publicar</>
            )}
          </Button>
        </div>
      </div>

      {/* Cover & description */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-6">
            {product.cover_url ? (
              <div className="flex-shrink-0 space-y-2">
                <img
                  src={product.cover_url}
                  alt={product.title}
                  className="h-40 w-40 rounded-xl object-cover border border-border"
                />
                <a
                  href={product.cover_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline justify-center"
                >
                  <Image className="h-3 w-3" /> Baixar capa
                </a>
              </div>
            ) : (
              <div className="h-40 w-40 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm whitespace-pre-wrap">
                  {product.description || "Sem descrição."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Vendas Aprovadas",
            value: salesData?.completedSales || 0,
            icon: ShoppingCart,
          },
          {
            label: "Faturamento",
            value: fmt(salesData?.totalRevenue || 0),
            icon: DollarSign,
          },
          {
            label: "Taxa de Conversão",
            value: `${conversionRate.toFixed(1)}%`,
            icon: TrendingUp,
          },
          {
            label: "Compradores",
            value: accessCount || 0,
            icon: Users,
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <stat.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-xl font-bold mt-1">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Deliverable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {product.type === "course" ? (
              <BookOpen className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={1.5} />
            )}
            Entregável
          </CardTitle>
        </CardHeader>
        <CardContent>
          {product.type === "course" ? (
            // Course: show modules & lessons
            modules && modules.length > 0 ? (
              <div className="space-y-4">
                {modules.map((mod, mi) => (
                  <div key={mod.id}>
                    <p className="text-sm font-semibold mb-2">
                      Módulo {mi + 1}: {mod.title}
                    </p>
                    <div className="space-y-1 ml-4">
                      {mod.lessons.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma aula cadastrada.</p>
                      ) : (
                        mod.lessons.map((lesson, li) => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-lg hover:bg-muted/30"
                          >
                            <span className="text-xs text-muted-foreground w-5">
                              {li + 1}.
                            </span>
                            <span className="flex-1 truncate">{lesson.title}</span>
                            {lesson.video_url && (
                              <a
                                href={lesson.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {lesson.duration_minutes ? (
                              <span className="text-xs text-muted-foreground">
                                {lesson.duration_minutes} min
                              </span>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                    {mi < modules.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum módulo cadastrado neste curso.
              </p>
            )
          ) : (
            // Download product
            <div className="space-y-3">
              {product.file_url ? (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                  <FileDown className="h-8 w-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Arquivo entregável</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {product.file_url.split("/").pop()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => window.open(product.file_url!, "_blank")}
                    >
                      <Eye className="h-3.5 w-3.5" /> Visualizar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => downloadFile(product.file_url!, product.file_url!.split("/").pop() || "arquivo")}
                    >
                      <Download className="h-3.5 w-3.5" /> Baixar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum arquivo entregável configurado.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buyers — custom audience data */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" strokeWidth={1.5} />
            Compradores ({buyers.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyEmails(buyers)}>
              <Copy className="h-3.5 w-3.5" /> Copiar emails
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                exportCSV(buyers, `compradores-${product.title}.csv`, [
                  { key: "buyer_name", label: "Nome" },
                  { key: "buyer_email", label: "Email" },
                  { key: "buyer_phone", label: "Telefone" },
                  { key: "buyer_cpf", label: "CPF" },
                  { key: "buyer_city", label: "Cidade" },
                  { key: "buyer_state", label: "UF" },
                  { key: "amount", label: "Valor (centavos)" },
                  { key: "created_at", label: "Data" },
                  { key: "utm_source", label: "UTM Source" },
                  { key: "utm_campaign", label: "UTM Campaign" },
                ])
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {buyers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum comprador ainda.</p>
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Nome / Email</th>
                    <th className="text-left font-medium px-2 py-2">Telefone</th>
                    <th className="text-left font-medium px-2 py-2">Localização</th>
                    <th className="text-right font-medium px-2 py-2">Pago</th>
                    <th className="text-right font-medium px-2 py-2">Total na plataforma</th>
                    <th className="text-left font-medium px-4 py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((b: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <p className="font-medium">{b.buyer_name || "—"}</p>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {b.buyer_email || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-2 font-mono">{b.buyer_phone || "—"}</td>
                      <td className="px-2 py-2">{[b.buyer_city, b.buyer_state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-2 py-2 text-right font-medium text-primary">{fmt(b.amount)}</td>
                      <td className="px-2 py-2 text-right font-medium">
                        {fmt(platformSpentMap[b.buyer_email] || b.amount)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(b.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Audiences — Meta & Google ready-to-import */}
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" strokeWidth={1.5} />
            Públicos personalizados
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Segmentos prontos com hash SHA-256 — importe direto no Meta Ads ou Google Ads sem conversão manual.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {segments.map((seg) => {
            const empty = seg.rows.length === 0;
            const metaKey = `meta-${seg.id}`;
            const googleKey = `google-${seg.id}`;
            return (
              <div
                key={seg.id}
                className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
                  seg.tone === "amber" ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-card"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`h-3.5 w-3.5 ${seg.tone === "amber" ? "text-amber-500" : "text-primary"}`} strokeWidth={1.5} />
                    <p className="font-medium text-sm">{seg.title}</p>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {seg.rows.length} {seg.rows.length === 1 ? "contato" : "contatos"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{seg.description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={empty || exporting === metaKey}
                    onClick={() => handleAudienceExport("meta", seg)}
                  >
                    {exporting === metaKey ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                    Meta Ads
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={empty || exporting === googleKey}
                    onClick={() => handleAudienceExport("google", seg)}
                  >
                    {exporting === googleKey ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                    Google Ads
                  </Button>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground pt-1">
            Os arquivos seguem o padrão exigido por cada plataforma (Meta: EMAIL_SHA256/PHONE_SHA256 + FN/LN/CT/ST; Google: Customer Match com email e telefone hasheados). Basta enviar na criação do público.
          </p>
        </CardContent>
      </Card>

      {/* Abandoned carts — remarketing pool */}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
            Carrinhos Abandonados ({abandoned.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyEmails(abandoned)}>
              <Copy className="h-3.5 w-3.5" /> Copiar emails
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                exportCSV(abandoned, `abandonos-${product.title}.csv`, [
                  { key: "buyer_name", label: "Nome" },
                  { key: "buyer_email", label: "Email" },
                  { key: "buyer_phone", label: "Telefone" },
                  { key: "buyer_cpf", label: "CPF" },
                  { key: "amount", label: "Valor (centavos)" },
                  { key: "status", label: "Status" },
                  { key: "created_at", label: "Data" },
                  { key: "utm_source", label: "UTM Source" },
                  { key: "utm_campaign", label: "UTM Campaign" },
                ])
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {abandoned.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum carrinho abandonado.</p>
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Nome / Email</th>
                    <th className="text-left font-medium px-2 py-2">Telefone</th>
                    <th className="text-right font-medium px-2 py-2">Valor</th>
                    <th className="text-left font-medium px-2 py-2">Status</th>
                    <th className="text-left font-medium px-4 py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {abandoned.map((b: any) => (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <p className="font-medium">{b.buyer_name || "—"}</p>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {b.buyer_email || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-2 font-mono">{b.buyer_phone || "—"}</td>
                      <td className="px-2 py-2 text-right font-medium">{fmt(b.amount)}</td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className="text-[0.6rem]">{b.status}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(b.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checkout link */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Link do Checkout</p>
            <p className="text-xs text-muted-foreground truncate max-w-md">
              {window.location.origin}/checkout/{product.id}
            </p>
          </div>
          <a
            href={`/checkout/${product.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Ver Checkout
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
