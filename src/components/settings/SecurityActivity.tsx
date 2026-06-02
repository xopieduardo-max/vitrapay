import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, KeyRound, Smartphone, IdCard, BadgeCheck, Banknote, LogIn } from "lucide-react";

type AuditRow = {
  id: string;
  event_type: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

const EVENT_META: Record<string, { label: string; icon: any }> = {
  pix_key_changed: { label: "Chave PIX alterada", icon: Banknote },
  pix_key_type_changed: { label: "Tipo da chave PIX alterado", icon: Banknote },
  cpf_changed: { label: "CPF alterado", icon: IdCard },
  phone_changed: { label: "Telefone alterado", icon: Smartphone },
  profile_verified: { label: "Perfil verificado", icon: BadgeCheck },
  password_changed: { label: "Senha alterada", icon: KeyRound },
  withdrawal_requested: { label: "Saque solicitado", icon: Banknote },
  login_failed: { label: "Tentativa de login falhou", icon: LogIn },
  two_fa_changed: { label: "Verificação em duas etapas alterada", icon: Shield },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function SecurityActivity() {
  const { user } = useAuth();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["security-audit", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_audit_log" as any)
        .select("id, event_type, old_value, new_value, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) {
        console.warn("[audit] fetch error", error);
        return [];
      }
      return (data as unknown as AuditRow[]) || [];
    },
  });

  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 p-5">
      <header className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Atividade da conta</h2>
      </header>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      )}

      {!isLoading && events.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum evento de segurança registrado ainda.
        </p>
      )}

      {!isLoading && events.length > 0 && (
        <ul className="divide-y divide-border/40">
          {events.map((ev) => {
            const meta = EVENT_META[ev.event_type] ?? {
              label: ev.event_type,
              icon: Shield,
            };
            const Icon = meta.icon;
            return (
              <li key={ev.id} className="flex items-start gap-3 py-2.5">
                <div className="w-7 h-7 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{meta.label}</p>
                  {(ev.old_value || ev.new_value) && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {ev.old_value ? `de ${ev.old_value} ` : ""}
                      {ev.new_value ? `para ${ev.new_value}` : ""}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatDate(ev.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground mt-4">
        Se você não reconhece alguma atividade, troque sua senha imediatamente
        e entre em contato com o suporte.
      </p>
    </section>
  );
}
