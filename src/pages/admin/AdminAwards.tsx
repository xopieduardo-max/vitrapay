import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Truck, CheckCircle, Copy, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAdminAudit } from "@/hooks/useAdminAudit";
import { TIERS } from "@/components/MilestoneTracker";
import { motion, AnimatePresence } from "framer-motion";

const fmt = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/30" },
  approved: { label: "Aprovada", className: "bg-primary/10 text-primary border-primary/30" },
  shipped: { label: "Enviada", className: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  delivered: { label: "Entregue", className: "bg-green-500/10 text-green-500 border-green-500/30" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface AwardRow {
  id: string;
  user_id: string;
  milestone: number;
  status: string;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_cep: string | null;
  shipping_street: string | null;
  shipping_number: string | null;
  shipping_complement: string | null;
  shipping_neighborhood: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  tracking_code: string | null;
  admin_notes: string | null;
  shipped_at: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  total_revenue: number;
}

export default function AdminAwards() {
  const qc = useQueryClient();
  const { logAction } = useAdminAudit();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<AwardRow | null>(null);
  const [editStatus, setEditStatus] = useState("pending");
  const [editTracking, setEditTracking] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewTier, setPreviewTier] = useState<string | null>(null);
  const [showPreviewPicker, setShowPreviewPicker] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-award-requests"],
    queryFn: async () => {
      const { data: requests } = await supabase
        .from("award_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (!requests || requests.length === 0) return [];

      const userIds = Array.from(new Set(requests.map((r: any) => r.user_id)));
      const [{ data: profiles }, { data: emails }, { data: sales }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
        supabase.rpc("get_user_emails"),
        supabase.from("sales").select("producer_id, amount, status").in("producer_id", userIds).eq("status", "completed"),
      ]);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.display_name || "Sem nome"; });
      const emailMap: Record<string, string> = {};
      (emails || []).forEach((e: any) => { emailMap[e.user_id] = e.email; });
      const revMap: Record<string, number> = {};
      (sales || []).forEach((s: any) => { revMap[s.producer_id] = (revMap[s.producer_id] || 0) + s.amount; });

      return requests.map((r: any) => ({
        ...r,
        milestone: Number(r.milestone),
        user_name: nameMap[r.user_id] || "—",
        user_email: emailMap[r.user_id] || "",
        total_revenue: revMap[r.user_id] || 0,
      })) as AwardRow[];
    },
  });

  const filtered = useMemo(() => {
    let res = rows;
    if (statusFilter !== "all") res = res.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter((r) => r.user_name.toLowerCase().includes(q) || r.user_email.toLowerCase().includes(q));
    }
    return res;
  }, [rows, search, statusFilter]);

  const openEdit = (row: AwardRow) => {
    setEditing(row);
    setEditStatus(row.status);
    setEditTracking(row.tracking_code || "");
    setEditNotes(row.admin_notes || "");
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const patch: any = {
      status: editStatus,
      tracking_code: editTracking.trim() || null,
      admin_notes: editNotes.trim() || null,
    };
    if (editStatus === "shipped" && !editing.shipped_at) patch.shipped_at = new Date().toISOString();
    if (editStatus === "delivered") patch.delivered_at = new Date().toISOString();

    const { error } = await supabase.from("award_requests").update(patch).eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atualizar.");
      return;
    }
    toast.success("Solicitação atualizada.");
    await logAction("award_request_updated", "award_request", editing.id, patch);
    qc.invalidateQueries({ queryKey: ["admin-award-requests"] });
    setEditing(null);
  };

  const copyAddress = (r: AwardRow) => {
    const txt = [
      r.shipping_name,
      `${r.shipping_street}, ${r.shipping_number}${r.shipping_complement ? " - " + r.shipping_complement : ""}`,
      `${r.shipping_neighborhood} - ${r.shipping_city}/${r.shipping_state}`,
      `CEP: ${r.shipping_cep}`,
      `Tel: ${r.shipping_phone}`,
    ].join("\n");
    navigator.clipboard.writeText(txt);
    toast.success("Endereço copiado.");
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Placas de Premiação</h1>
            <p className="text-sm text-muted-foreground">{rows.length} solicitação(ões) — produtores que atingiram metas de faturamento.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowPreviewPicker(true)}>
          <Eye className="h-4 w-4 mr-1.5" />
          Visualizar preview
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma solicitação encontrada.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => {
              const sc = statusConfig[r.status] || statusConfig.pending;
              return (
                <div key={r.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{r.user_name}</span>
                        <Badge variant="outline" className="text-[0.65rem] gap-1 bg-primary/10 text-primary border-primary/30">
                          <Trophy className="h-3 w-3" />
                          {fmt(r.milestone)}
                        </Badge>
                        <Badge variant="outline" className={`text-[0.65rem] ${sc.className}`}>{sc.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.user_email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Faturamento atual: <span className="text-foreground font-medium">{fmt(r.total_revenue)}</span> · Solicitado em {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                      </p>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                        <p><span className="text-muted-foreground">Destinatário:</span> {r.shipping_name}</p>
                        <p><span className="text-muted-foreground">Telefone:</span> {r.shipping_phone}</p>
                        <p className="md:col-span-2">
                          <span className="text-muted-foreground">Endereço:</span>{" "}
                          {r.shipping_street}, {r.shipping_number}
                          {r.shipping_complement ? ` - ${r.shipping_complement}` : ""} — {r.shipping_neighborhood}, {r.shipping_city}/{r.shipping_state} — CEP {r.shipping_cep}
                        </p>
                        {r.tracking_code && (
                          <p className="md:col-span-2"><span className="text-muted-foreground">Rastreio:</span> <span className="font-mono text-primary">{r.tracking_code}</span></p>
                        )}
                        {r.admin_notes && (
                          <p className="md:col-span-2"><span className="text-muted-foreground">Obs.:</span> {r.admin_notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => copyAddress(r)}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" />Copiar endereço
                      </Button>
                      <Button size="sm" onClick={() => openEdit(r)}>
                        <Truck className="h-3.5 w-3.5 mr-1.5" />Gerenciar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Gerenciar placa — {editing && fmt(editing.milestone)}
            </DialogTitle>
            <DialogDescription>{editing?.user_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Código de rastreio</Label>
              <Input value={editTracking} onChange={(e) => setEditTracking(e.target.value)} placeholder="Ex: BR123456789BR" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Observações internas</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
