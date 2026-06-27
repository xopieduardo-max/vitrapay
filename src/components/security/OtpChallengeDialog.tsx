import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, Mail } from "lucide-react";

type Action = "withdraw" | "pix_change";

interface OtpChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: Action;
  title?: string;
  description?: string;
  onConfirmed: (actionToken: string) => Promise<void> | void;
}

export function OtpChallengeDialog({
  open,
  onOpenChange,
  action,
  title,
  description,
  onConfirmed,
}: OtpChallengeDialogProps) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingPassword, setConfirmingPassword] = useState(false);
  const [emailMasked, setEmailMasked] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [method, setMethod] = useState<"password" | "email">("password");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) {
      setCode("");
      setPassword("");
      setMethod("password");
      setEmailMasked(null);
      setCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    if (open && method === "email" && !emailMasked && cooldown === 0) {
      void requestCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode() {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-sensitive-otp", {
        body: { action },
      });
      if (error) {
        const ctx = (error as any)?.context;
        const body = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.error || error.message || "Falha ao enviar código");
      }
      setEmailMasked(data?.email_masked || null);
      setCooldown(45);
      toast.success("Código enviado para seu e-mail.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar código");
    } finally {
      setSending(false);
    }
  }

  async function handlePasswordConfirm() {
    if (!password.trim()) {
      toast.error("Digite sua senha para confirmar.");
      return;
    }
    setConfirmingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-sensitive-password", {
        body: { action, password },
      });
      if (error) {
        const ctx = (error as any)?.context;
        const body = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.error || error.message || "Falha ao confirmar senha");
      }
      const token = data?.action_token as string | undefined;
      if (!token) throw new Error("Confirmação não emitida.");
      await onConfirmed(token);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao confirmar senha");
    } finally {
      setConfirmingPassword(false);
    }
  }

  async function handleConfirm() {
    if (code.length !== 6) {
      toast.error("Digite os 6 dígitos do código.");
      return;
    }
    setConfirming(true);
    try {
      const { data, error } = await supabase.rpc("consume_sensitive_challenge" as any, {
        _action: action,
        _code: code,
      });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("invalid_code")) throw new Error("Código incorreto.");
        if (msg.includes("expired")) throw new Error("Código expirado. Solicite outro.");
        if (msg.includes("too_many_attempts")) throw new Error("Tentativas excedidas. Solicite outro código.");
        if (msg.includes("no_active_challenge")) throw new Error("Nenhum código ativo. Solicite outro.");
        throw new Error("Falha ao validar código.");
      }
      const token = data as unknown as string;
      if (!token) throw new Error("Token não emitido.");
      await onConfirmed(token);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao confirmar");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {method === "password" ? <Lock className="h-5 w-5 text-primary" /> : <Mail className="h-5 w-5 text-primary" />}
            {title || "Confirmar por e-mail"}
          </DialogTitle>
          <DialogDescription>
            Confirme com sua senha da conta. Se preferir, use um código enviado para o e-mail cadastrado.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={method} onValueChange={(value) => setMethod(value as "password" | "email")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">Senha</TabsTrigger>
            <TabsTrigger value="email">E-mail</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handlePasswordConfirm();
                }}
              />
              <p className="text-xs text-muted-foreground">Usaremos sua senha apenas para confirmar esta ação.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={confirmingPassword}>
                Cancelar
              </Button>
              <Button onClick={handlePasswordConfirm} disabled={confirmingPassword || !password.trim()}>
                {confirmingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 pt-3">
            <div className="text-sm text-muted-foreground">
              {description || "Enviamos um código de 6 dígitos para o e-mail cadastrado."}
              {emailMasked && <span className="block mt-1 text-foreground font-medium">{emailMasked}</span>}
            </div>
            <div className="flex flex-col items-center gap-4 py-2">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <button
                type="button"
                onClick={requestCode}
                disabled={sending || cooldown > 0}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {sending
                  ? "Enviando..."
                  : cooldown > 0
                  ? `Reenviar em ${cooldown}s`
                  : "Enviar código"}
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={confirming}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={confirming || code.length !== 6}>
                {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
