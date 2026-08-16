import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ThemeLogo } from "@/components/ThemeLogo";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session) {
        setReady(true);
        setInvalid(false);
      } else if (event === "SIGNED_OUT") {
        setReady(false);
      }
    });

    (async () => {
      const hash = window.location.hash || "";
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (hash.includes("access_token")) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const access_token = params.get("access_token") || "";
          const refresh_token = params.get("refresh_token") || "";
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }
        }
      } catch {
        /* handled below by session check */
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setReady(true);
        // limpa tokens da URL
        window.history.replaceState({}, "", "/reset-password");
      } else {
        setInvalid(true);
      }
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "As senhas não coincidem", description: "Confirme a nova senha corretamente.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha alterada!", description: "Sua nova senha já está ativa." });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Não foi possível alterar a senha.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#080808] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -right-32 top-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full opacity-70 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(48, 96%, 53%) 0%, hsl(38, 92%, 45%) 40%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-[480px] rounded-3xl bg-[#0f0f0f]/40 backdrop-blur-3xl border border-white/15 p-8 lg:p-10">
          <Link to="/" className="inline-flex items-center mb-8">
            <ThemeLogo variant="horizontal" className="h-10 object-contain" />
          </Link>

          {invalid && !ready ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold tracking-tight">Link inválido ou expirado</h1>
              <p className="text-sm text-white/60">
                O link de redefinição de senha não é mais válido. Solicite um novo e-mail de recuperação.
              </p>
              <Button asChild className="w-full h-12 rounded-xl bg-white text-black hover:bg-white/90 font-semibold">
                <Link to="/auth?forgot=1">Solicitar novo link</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Criar nova senha</h1>
              <p className="mt-2 text-sm text-white/60">Defina a nova senha de acesso à sua conta.</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-white/70">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                      placeholder="Mínimo 6 caracteres"
                      className="h-14 bg-white/[0.04] border-white/10 rounded-xl px-4 pr-12 text-white placeholder:text-white/40 focus-visible:border-primary focus-visible:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-white/70">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={6}
                    required
                    placeholder="Repita a nova senha"
                    className="h-14 bg-white/[0.04] border-white/10 rounded-xl px-4 text-white placeholder:text-white/40 focus-visible:border-primary focus-visible:ring-0"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !ready}
                  className="w-full h-14 rounded-xl bg-white text-black hover:bg-white/90 text-base font-semibold"
                >
                  {loading ? "Salvando..." : ready ? "Salvar nova senha" : "Validando link..."}
                </Button>
              </form>

              <Link to="/auth" className="mt-6 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
