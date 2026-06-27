import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleId: string;
  productTitle: string;
}

const REASONS = [
  { v: "no_access", l: "Não consegui acessar o produto" },
  { v: "broken_file", l: "Arquivo corrompido ou link quebrado" },
  { v: "wrong_product", l: "Produto diferente do anunciado" },
  { v: "refund", l: "Quero solicitar reembolso" },
  { v: "other", l: "Outro motivo" },
];

export function ReportProblemDialog({ open, onOpenChange, saleId, productTitle }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user || !reason || !details.trim()) { toast.error("Selecione o motivo e descreva o problema."); return; }
    setLoading(true);
    const subject = `Problema com compra ${saleId.slice(0, 8).toUpperCase()} — ${REASONS.find(r => r.v === reason)?.l}`;
    const { data: t, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, subject })
      .select()
      .single();
    if (error || !t) { setLoading(false); toast.error("Erro ao abrir chamado."); return; }
    await supabase.from("support_messages").insert({
      ticket_id: t.id, sender_id: user.id, is_admin: false,
      body: `Produto: ${productTitle}\nVenda: ${saleId}\nMotivo: ${REASONS.find(r => r.v === reason)?.l}\n\n${details.trim()}`,
    });
    setLoading(false);
    onOpenChange(false);
    toast.success("Chamado aberto! Nossa equipe responderá em breve.");
    navigate("/support");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar problema</DialogTitle>
          <DialogDescription className="line-clamp-2">{productTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
            <SelectContent>
              {REASONS.map(r => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Descreva o que aconteceu com o máximo de detalhes"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Abrir chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
