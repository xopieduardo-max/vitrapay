import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import { ExportButton } from "@/components/ExportButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  RotateCcw,
  Calendar,
  DollarSign,
  User,
  CreditCard,
  Package,
  Loader2,
  ShieldAlert,
  TrendingDown,
  FileText,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { useAdminAudit } from "@/hooks/useAdminAudit";

const fmt = (v: number) =>
  `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const DATE_FILTERS = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
  { label: "Tudo", value: "all" },
];

function getFilterDate(filter: string): Date | null {
  const now = new Date();
  switch (filter) {
    case "7d": { const d = new Date(); d.setDate(d.getDate() - 7); return d; }
    case "30d": { const d = new Date(); d.setDate(d.getDate() - 30); return d; }
    case "90d": { const d = new Date(); d.setDate(d.getDate() - 90); return d; }
    default: return null;
  }
}

export default function AdminDisputes() {
  const [dateFilter, setDateFilter] = useState("30d");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const queryClient = useQueryClient();
  const { logAction } = useAdminAudit();

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, amount, platform_fee, status, created_at, payment_provider, payment_id, product_id, producer_id, buyer_id, dispute_note, dispute_resolved, dispute_resolved_at, products(title)")
        .in("status", ["refunded", "chargeback", "med"])
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-dispute-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      return data || [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => { map[p.user_id] = p.display_name || "Sem nome"; });
    return map;
  }, [profiles]);

  const filtered = useMemo(() => {
    let list = disputes;
    if (typeFilter !== "all") list = list.filter((d: any) => d.status === typeFilter);
    const startDate = getFilterDate(dateFilter);
    if (startDate) list = list.filter((d: any) => new Date(d.created_at) >= startDate);
    return list;
  }, [disputes, typeFilter, dateFilter]);

  const totalRefunded = filtered.filter((d: any) => d.status === "refunded");
  const totalChargeback = filtered.filter((d: any) => d.status === "chargeback");
  const totalMED = filtered.filter((d: any) => d.status === "med");
  const refundedAmount = totalRefunded.reduce((a: number, d: any) => a + d.amount, 0);
  const chargebackAmount = totalChargeback.reduce((a: number, d: any) => a + d.amount, 0);
  const medAmount = totalMED.reduce((a: number, d: any) => a + d.amount, 0);
  const totalLoss = refundedAmount + chargebackAmount + medAmount;
  const feeImpact = filtered.reduce((a: number, d: any) => a + (d.platform_fee || 0), 0);

  const statusMap: Record<string, { label: string; icon: any; className: string }> = {
    refunded: { label: "Estorno", icon: RotateCcw, className: "bg-warning/10 text-warning border-warning/20" },
    chargeback: { label: "Chargeback", icon: ShieldAlert, className: "bg-destructive/10 text-destructive border-destructive/20" },
    med: { label: "MED Pix", icon: AlertTriangle, className: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  };

  const exportColumns = [
    { key: "product_title", label: "Produto" },
    { key: "producer_name", label: "Produtor" },
    { key: "type", label: "Tipo" },
    { key: "amount_formatted", label: "Valor (R$)" },
    { key: "payment_provider", label: "Pagamento" },
    { key: "created_at", label: "Data" },
  ];

  const exportData = filtered.map((d: any) => ({
    product_title: d.products?.title || "Produto removido",
    producer_name: profileMap[d.producer_id] || "—",
    type: d.status === "chargeback" ? "Chargeback" : d.status === "med" ? "MED Pix" : "Estorno",
    amount_formatted: (d.amount / 100).toFixed(2),
    payment_provider: d.payment_provider || "N/A",
    created_at: new Date(d.created_at).toLocaleDateString("pt-BR"),
  }));

  const openDispute = (d: any) => {
    setSelectedDispute(d);
    setNoteText(d.dispute_note || "");
  };

  const saveNote = async (resolved: boolean) => {
    if (!selectedDispute) return;
    setSavingNote(true);
    const updates: any = { dispute_note: noteText.trim() || null, dispute_resolved: resolved };
    if (resolved && !selectedDispute.dispute_resolved) {
      updates.dispute_resolved_at = new Date().toISOString();
    } else if (!resolved) {
      updates.dispute_resolved_at = null;
    }
    const { error } = await supabase.from("sales").update(updates).eq("id", selectedDispute.id);
    if (error) {
      toast.error("Erro ao salvar nota.");
    } else {
      toast.success(resolved ? "Disputa marcada como resolvida!" : "Nota salva!");
      await logAction(resolved ? "community_approved" : "community_rejected", "dispute", selectedDispute.id, { note: noteText.trim() || null });
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      setSelectedDispute({ ...selectedDispute, ...updates });
    }
    setSavingNote(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Disputas & Estornos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada de todos os chargebacks e estornos da plataforma
          </p>
        </div>
        <ExportButton data={exportData} columns={exportColumns} filename="disputas-vitrapay" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {DATE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setDateFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-8 bg-card border-border text-xs">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="refunded">Estornos</SelectItem>
            <SelectItem value="chargeback">Chargebacks</SelectItem>
            <SelectItem value="med">MED Pix</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <TrendingDown className="h-4 w-4" /> Perda Total
          </div>
          <p className="text-xl font-bold text-destructive">{fmt(totalLoss)}</p>
          <p className="text-[0.65rem] text-muted-foreground mt-1">{filtered.length} disputa(s)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <RotateCcw className="h-4 w-4" /> Estornos
          </div>
          <p className="text-xl font-bold text-warning">{fmt(refundedAmount)}</p>
          <p className="text-[0.65rem] text-muted-foreground mt-1">{totalRefunded.length} estorno(s)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <ShieldAlert className="h-4 w-4" /> Chargebacks
          </div>
          <p className="text-xl font-bold text-destructive">{fmt(chargebackAmount)}</p>
          <p className="text-[0.65rem] text-muted-foreground mt-1">{totalChargeback.length} chargeback(s)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <AlertTriangle className="h-4 w-4" /> MED Pix
          </div>
          <p className="text-xl font-bold text-orange-500">{fmt(medAmount)}</p>
          <p className="text-[0.65rem] text-muted-foreground mt-1">{totalMED.length} MED(s)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <DollarSign className="h-4 w-4" /> Taxa Perdida
          </div>
          <p className="text-xl font-bold">{fmt(feeImpact)}</p>
          <p className="text-[0.65rem] text-muted-foreground mt-1">Taxa plataforma devolvida</p>
        </div>
      </div>

      {/* Disputes List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">Disputas ({filtered.length})</h3>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma disputa encontrada neste período.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((d: any, i: number) => {
              const st = statusMap[d.status] || statusMap.refunded;
              const Icon = st.icon;
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.3 }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => openDispute(d)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${st.className}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {d.products?.title || "Produto removido"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profileMap[d.producer_id] || "—"} · {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Badge variant="secondary" className={`text-[0.6rem] ${st.className}`}>
                      {st.label}
                    </Badge>
                    {d.dispute_resolved && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                    )}
                    {d.dispute_note && !d.dispute_resolved && (
                      <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <span className="text-sm font-semibold min-w-[80px] text-right text-destructive">
                      -{fmt(d.amount)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={(open) => !open && setSelectedDispute(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhes da Disputa</DialogTitle>
          </DialogHeader>
          {selectedDispute && (() => {
            const st = statusMap[selectedDispute.status] || statusMap.refunded;
            return (
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${st.className}`}>
                    <st.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{selectedDispute.products?.title || "Produto removido"}</p>
                    <Badge variant="secondary" className={`text-[0.6rem] mt-1 ${st.className}`}>{st.label}</Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: DollarSign, label: "Valor", value: fmt(selectedDispute.amount) },
                    { icon: DollarSign, label: "Taxa perdida", value: fmt(selectedDispute.platform_fee || 0) },
                    { icon: Calendar, label: "Data", value: new Date(selectedDispute.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                    { icon: CreditCard, label: "Pagamento", value: selectedDispute.payment_provider || "N/A" },
                    { icon: User, label: "Produtor", value: profileMap[selectedDispute.producer_id] || "—" },
                    { icon: FileText, label: "ID Pagamento", value: selectedDispute.payment_id?.slice(0, 20) || "—" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-2">
                        <item.icon className="h-3.5 w-3.5" /> {item.label}
                      </span>
                      <span className="text-sm font-medium">{item.value}</span>
                    </div>
                  ))}

                  {/* Resolution status */}
                  {selectedDispute.dispute_resolved && (
                    <div className="flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 p-3 text-sm text-accent">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Resolvida em {selectedDispute.dispute_resolved_at
                        ? new Date(selectedDispute.dispute_resolved_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </div>
                  )}

                  {/* Admin note */}
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Nota interna
                    </Label>
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Registre o que foi feito, contato com o cliente, resultado..."
                      rows={3}
                      className="bg-muted/50 border-transparent focus:border-border text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => saveNote(false)} disabled={savingNote} className="flex-1">
                      {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Salvar Nota
                    </Button>
                    {!selectedDispute.dispute_resolved && (
                      <Button size="sm" onClick={() => saveNote(true)} disabled={savingNote} className="flex-1 gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Marcar Resolvida
                      </Button>
                    )}
                    {selectedDispute.dispute_resolved && (
                      <Button size="sm" variant="outline" onClick={() => saveNote(false)} disabled={savingNote} className="flex-1 text-muted-foreground">
                        Reabrir disputa
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
