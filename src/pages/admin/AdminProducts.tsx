import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, Search, Loader2, ShoppingBag, TrendingUp, ArrowUpDown, Eye,
} from "lucide-react";
import { motion } from "framer-motion";

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface Row {
  id: string;
  title: string;
  cover_url: string | null;
  price: number;
  type: string;
  is_published: boolean;
  created_at: string;
  producer_id: string;
  producer_name: string;
  producer_email: string;
  salesCount: number;
  revenue: number;
}

export default function AdminProducts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [sortBy, setSortBy] = useState<"recent" | "revenue" | "sales">("recent");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-products-list"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: products }, { data: salesData }, { data: profiles }, { data: emails }] =
        await Promise.all([
          supabase
            .from("products")
            .select("id, title, cover_url, price, type, is_published, created_at, producer_id")
            .order("created_at", { ascending: false }),
          supabase.from("sales").select("product_id, amount, status"),
          supabase.from("profiles").select("user_id, display_name"),
          supabase.rpc("get_user_emails"),
        ]);

      const salesMap: Record<string, { count: number; revenue: number }> = {};
      (salesData || [])
        .filter((s: any) => s.status === "completed")
        .forEach((s: any) => {
          if (!s.product_id) return;
          if (!salesMap[s.product_id]) salesMap[s.product_id] = { count: 0, revenue: 0 };
          salesMap[s.product_id].count++;
          salesMap[s.product_id].revenue += s.amount;
        });

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        nameMap[p.user_id] = p.display_name || "Sem nome";
      });
      const emailMap: Record<string, string> = {};
      (emails || []).forEach((e: any) => {
        emailMap[e.user_id] = e.email;
      });

      return (products || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        cover_url: p.cover_url,
        price: p.price,
        type: p.type,
        is_published: p.is_published,
        created_at: p.created_at,
        producer_id: p.producer_id,
        producer_name: nameMap[p.producer_id] || "—",
        producer_email: emailMap[p.producer_id] || "",
        salesCount: salesMap[p.id]?.count || 0,
        revenue: salesMap[p.id]?.revenue || 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    let r = rows;
    if (status !== "all") {
      r = r.filter((x) => (status === "published" ? x.is_published : !x.is_published));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          x.producer_name.toLowerCase().includes(q) ||
          x.producer_email.toLowerCase().includes(q),
      );
    }
    if (sortBy === "revenue") r = [...r].sort((a, b) => b.revenue - a.revenue);
    else if (sortBy === "sales") r = [...r].sort((a, b) => b.salesCount - a.salesCount);
    return r;
  }, [rows, status, search, sortBy]);

  const totals = useMemo(
    () => ({
      products: filtered.length,
      sales: filtered.reduce((a, b) => a + b.salesCount, 0),
      revenue: filtered.reduce((a, b) => a + b.revenue, 0),
    }),
    [filtered],
  );

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
        <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todos os produtos da plataforma — clique para ver detalhes do produto.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Produtos", value: totals.products.toString(), icon: Package },
          { label: "Vendas (filtro)", value: totals.sales.toString(), icon: ShoppingBag },
          { label: "Faturamento (filtro)", value: fmt(totals.revenue), icon: TrendingUp },
        ].map((m) => (
          <Card key={m.label} className="border-border">
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {m.label}
                </span>
                <m.icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
              </div>
              <p className="text-xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto, produtor ou email..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="published">Publicados</SelectItem>
            <SelectItem value="draft">Rascunhos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recente</SelectItem>
            <SelectItem value="revenue">Maior faturamento</SelectItem>
            <SelectItem value="sales">Mais vendas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03, duration: 0.35, ease: [0.2, 0, 0, 1] }}
              onClick={() => navigate(`/admin/product/${p.id}`)}
              className="text-left rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {p.cover_url ? (
                  <img
                    src={p.cover_url}
                    alt={p.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                )}
                <Badge
                  variant="outline"
                  className={`absolute top-2 left-2 text-[0.6rem] backdrop-blur-md ${
                    p.is_published
                      ? "bg-green-500/15 text-green-500 border-green-500/30"
                      : "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
                  }`}
                >
                  {p.is_published ? "Publicado" : "Rascunho"}
                </Badge>
                <Eye className="absolute top-2 right-2 h-4 w-4 text-white drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-sm font-semibold truncate">{p.title}</p>
                  <p className="text-[0.65rem] text-muted-foreground truncate">
                    por{" "}
                    <span
                      className="hover:text-primary cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/users/${p.producer_id}`);
                      }}
                    >
                      {p.producer_name}
                    </span>
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <div>
                    <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                      Vendas
                    </p>
                    <p className="text-sm font-bold">{p.salesCount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                      Faturamento
                    </p>
                    <p className="text-sm font-bold text-primary">{fmt(p.revenue)}</p>
                  </div>
                </div>
                <p className="text-[0.65rem] text-muted-foreground">Preço: {fmt(p.price)}</p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
