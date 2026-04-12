import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Package, Download, BookOpen, Image, FileDown, Users,
  TrendingUp, DollarSign, ShoppingCart, Loader2, Eye, ExternalLink,
} from "lucide-react";
import { downloadFile } from "@/lib/downloadFile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function AdminProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

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

  const conversionRate = (() => {
    const total = (pendingCount || 0) + (salesData?.totalSales || 0);
    if (total === 0) return 0;
    return ((salesData?.completedSales || 0) / total) * 100;
  })();

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
        <p className="text-xl font-bold text-primary">{fmt(product.price)}</p>
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => downloadFile(product.file_url!, product.file_url!.split("/").pop() || "arquivo")}
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </Button>
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
