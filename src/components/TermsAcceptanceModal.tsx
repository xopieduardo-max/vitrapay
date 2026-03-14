import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export function TermsAcceptanceModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkTerms = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("terms_accepted_at")
        .eq("user_id", user.id)
        .single();

      if (data && !data.terms_accepted_at) {
        setOpen(true);
      }
    };

    checkTerms();
  }, [user]);

  const handleAccept = async () => {
    if (!user || !accepted) return;
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao registrar aceite dos termos.");
    } else {
      toast.success("Termos aceitos com sucesso!");
      setOpen(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">Termos de Uso e Política de Privacidade</DialogTitle>
          <DialogDescription>
            Para continuar usando a plataforma, você precisa aceitar nossos termos.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-48 rounded-md border border-border p-4 text-sm text-muted-foreground">
          <p className="mb-3">
            Ao utilizar a plataforma, você concorda com os seguintes pontos principais:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>A plataforma atua como <strong>intermediadora tecnológica</strong> de pagamentos entre produtores e compradores.</li>
            <li>A responsabilidade pelo conteúdo, qualidade e entrega dos produtos é exclusivamente do <strong>produtor</strong>.</li>
            <li>Seus dados pessoais são tratados conforme a <strong>LGPD</strong> (Lei Geral de Proteção de Dados).</li>
            <li>Você se compromete a não utilizar a plataforma para atividades ilegais, fraudulentas ou que violem direitos de terceiros.</li>
            <li>Comissões e saques estão sujeitos às regras e prazos definidos pela plataforma.</li>
            <li>A plataforma pode suspender contas que violem os termos de uso.</li>
          </ul>
          <p className="mt-4">
            Leia os documentos completos para mais detalhes.
          </p>
        </ScrollArea>

        <div className="flex gap-4 text-sm">
          <Link to="/terms" target="_blank" className="text-primary underline hover:text-primary/80">
            Termos de Uso completos
          </Link>
          <Link to="/privacy" target="_blank" className="text-primary underline hover:text-primary/80">
            Política de Privacidade
          </Link>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="accept-terms"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
          />
          <label htmlFor="accept-terms" className="text-sm font-medium leading-none cursor-pointer">
            Li e aceito os Termos de Uso e a Política de Privacidade
          </label>
        </div>

        <DialogFooter>
          <Button onClick={handleAccept} disabled={!accepted || loading} className="w-full">
            {loading ? "Registrando..." : "Aceitar e Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
