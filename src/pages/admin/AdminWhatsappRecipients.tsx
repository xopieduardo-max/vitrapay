import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, MessageCircle, Send, Loader2 } from "lucide-react";

type Recipient = {
  id: string;
  phone: string;
  label: string | null;
  active: boolean;
  created_at: string;
};

export default function AdminWhatsappRecipients() {
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["admin_whatsapp_recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_whatsapp_recipients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipient[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin_whatsapp_recipients"] });

  const add = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Informe um número com DDD (ex: 43984220303)");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("admin_whatsapp_recipients")
      .insert({ phone: digits, label: label.trim() || null, active: true });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Esse número já está cadastrado" : error.message);
      return;
    }
    setPhone("");
    setLabel("");
    toast.success("Número adicionado");
    refresh();
  };

  const toggle = async (r: Recipient) => {
    const { error } = await supabase
      .from("admin_whatsapp_recipients")
      .update({ active: !r.active })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (r: Recipient) => {
    if (!confirm(`Remover ${r.phone}?`)) return;
    const { error } = await supabase
      .from("admin_whatsapp_recipients")
      .delete()
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Número removido");
    refresh();
  };

  const fmt = (p: string) => {
    const d = p.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return p;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <MessageCircle className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Alertas WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Números que recebem aviso quando entra um saque pendente.
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
          <Input
            placeholder="Número com DDD (43984220303)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            placeholder="Apelido (opcional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button onClick={add} disabled={saving}>
            <Plus className="size-4 mr-1" /> Adicionar
          </Button>
        </div>
      </Card>

      <Card className="divide-y">
        {isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && list.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum número cadastrado.</div>
        )}
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{fmt(r.phone)}</div>
              {r.label && <div className="text-xs text-muted-foreground">{r.label}</div>}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {r.active ? "Ativo" : "Inativo"}
              <Switch checked={r.active} onCheckedChange={() => toggle(r)} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(r)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
