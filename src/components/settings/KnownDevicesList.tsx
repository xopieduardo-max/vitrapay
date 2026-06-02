import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Monitor, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getDeviceHash } from "@/lib/deviceFingerprint";

type Device = {
  id: string;
  device_label: string | null;
  ip: string | null;
  user_agent: string | null;
  trusted: boolean;
  last_seen_at: string;
  first_seen_at: string;
  login_count: number;
  device_hash: string;
};

export function KnownDevicesList() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentHash, setCurrentHash] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data }, hash] = await Promise.all([
      supabase
        .from("user_known_devices")
        .select("*")
        .eq("user_id", user.id)
        .order("last_seen_at", { ascending: false }),
      getDeviceHash(),
    ]);
    setDevices((data as Device[]) || []);
    setCurrentHash(hash);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const remove = async (id: string, hash: string) => {
    if (hash === currentHash) {
      toast.error("Você não pode remover o dispositivo atual");
      return;
    }
    const { error } = await supabase.from("user_known_devices").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover dispositivo");
      return;
    }
    toast.success("Dispositivo removido");
    setDevices((d) => d.filter((x) => x.id !== id));
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando dispositivos...</p>;
  }

  if (devices.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum dispositivo registrado.</p>;
  }

  return (
    <div className="space-y-3">
      {devices.map((d) => {
        const isCurrent = d.device_hash === currentHash;
        return (
          <Card key={d.id} className="p-4 flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Monitor className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {d.device_label || "Dispositivo"}
                </span>
                {isCurrent && (
                  <span className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                    ESTE DISPOSITIVO
                  </span>
                )}
                {d.trusted && (
                  <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> CONFIÁVEL
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                IP {d.ip || "desconhecido"} • {d.login_count} acesso(s)
              </p>
              <p className="text-xs text-muted-foreground">
                Último acesso:{" "}
                {new Date(d.last_seen_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </p>
            </div>
            {!isCurrent && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(d.id, d.device_hash)}
                aria-label="Remover dispositivo"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </Card>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Você recebe um e-mail sempre que um novo dispositivo acessa sua conta.
      </p>
    </div>
  );
}
