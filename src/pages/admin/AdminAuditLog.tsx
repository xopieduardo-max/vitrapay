import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const actionLabels: Record<string, string> = {
  user_suspended: "Usuário suspenso",
  user_reactivated: "Usuário reativado",
  user_fee_updated: "Taxa de usuário alterada",
  withdrawal_approved: "Saque aprovado (manual)",
  withdrawal_rejected: "Saque rejeitado",
  withdrawal_pix_sent: "PIX de saque enviado",
  platform_settings_saved: "Configurações salvas",
  product_unpublished: "Produto despublicado",
  push_notification_sent: "Push enviado",
  banner_created: "Banner criado",
  banner_deleted: "Banner removido",
  community_approved: "Sugestão aprovada",
  community_rejected: "Sugestão rejeitada",
};

const actionColors: Record<string, string> = {
  user_suspended: "bg-destructive/10 text-destructive border-destructive/20",
  user_reactivated: "bg-accent/10 text-accent border-accent/20",
  user_fee_updated: "bg-primary/10 text-primary border-primary/20",
  withdrawal_approved: "bg-accent/10 text-accent border-accent/20",
  withdrawal_rejected: "bg-destructive/10 text-destructive border-destructive/20",
  withdrawal_pix_sent: "bg-primary/10 text-primary border-primary/20",
  platform_settings_saved: "bg-warning/10 text-warning border-warning/20",
};

export default function AdminAuditLog() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    refetchInterval: 30_000,
  });

  // Fetch admin names
  const adminIds = [...new Set(logs.map((l) => l.admin_id))];
  const { data: adminProfiles = [] } = useQuery({
    queryKey: ["audit-admin-profiles", adminIds],
    queryFn: async () => {
      if (!adminIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", adminIds);
      return data || [];
    },
    enabled: adminIds.length > 0,
  });
  const adminMap = Object.fromEntries(adminProfiles.map((p) => [p.user_id, p.display_name || "Admin"]));

  const filtered = logs.filter((l) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const label = (actionLabels[l.action] || l.action).toLowerCase();
      const admin = (adminMap[l.admin_id] || "").toLowerCase();
      const targetId = (l.target_id || "").toLowerCase();
      if (!label.includes(q) && !admin.includes(q) && !targetId.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          Log de Ações Admin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de todas as ações administrativas na plataforma
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ação, admin..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[220px] h-9 text-sm">
            <SelectValue placeholder="Tipo de ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {Object.entries(actionLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Histórico</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} registro(s)</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma ação registrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[0.65rem] ${actionColors[log.action] || "bg-muted/30 text-muted-foreground border-border"}`}
                    >
                      {actionLabels[log.action] || log.action}
                    </Badge>
                    {log.target_id && (
                      <span className="text-[0.65rem] text-muted-foreground font-mono">
                        {log.target_type}: {log.target_id.substring(0, 16)}{log.target_id.length > 16 ? "…" : ""}
                      </span>
                    )}
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {Object.entries(log.details as Record<string, unknown>)
                        .filter(([, v]) => v != null && v !== "")
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium">{adminMap[log.admin_id] || "Admin"}</p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
