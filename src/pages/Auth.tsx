import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeLogo } from "@/components/ThemeLogo";

type Step = "credentials" | "otp";

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        placeholder="Sua senha"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={6}
        className="h-14 bg-transparent border-white/10 rounded-xl px-4 pr-12 text-white placeholder:text-white/40 focus-visible:border-primary focus-visible:ring-0"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Safeguard: never hang forever. 20s timeout for the auth request.
    const withTimeout = <T,>(p: Promise<T>, ms = 20000): Promise<T> =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("__timeout__")), ms);
        p.then((v) => { clearTimeout(t); resolve(v); })
         .catch((e) => { clearTimeout(t); reject(e); });
      });

    try {
      if (isLogin) {
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({ email: email.trim(), password })
        );
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { error } = await withTimeout(
          supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: { display_name: displayName },
              emailRedirectTo: window.location.origin,
            },
          })
        );
        if (error) throw error;
        setStep("otp");
        setCountdown(60);
        toast({
          title: "Código enviado!",
          description: "Verifique seu e-mail e insira o código de 6 dígitos.",
        });
      }
    } catch (error: any) {
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      // Qualquer subdomínio *.lovable.app que não seja o publicado oficial é Preview/Sandbox
      const isPreview =
        /lovable\.app$/.test(host) &&
        host !== "vitrapay.lovable.app";
      let msg: string;
      if (error?.message === "__timeout__" || error?.message === "Load failed" || error?.message === "Failed to fetch") {
        msg = isPreview
          ? "O login não funciona no ambiente de Preview do Lovable (limitação técnica do proxy). Acesse https://vitrapay.com.br para entrar normalmente."
          : "Erro de conexão. Verifique sua internet e tente novamente.";
      } else if (error?.message === "Invalid login credentials") {
        msg = "E-mail ou senha incorretos.";
      } else {
        msg = error?.message || "Erro ao processar a solicitação.";
      }
      toast({ title: isPreview ? "Use a URL publicada" : "Erro", description: msg, variant: "destructive" });

    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      });
      if (error) throw error;
      toast({ title: "Conta confirmada!", description: "Bem-vindo à VitraPay." });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Código inválido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setCountdown(60);
      toast({ title: "Código reenviado!", description: "Confira seu e-mail." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#080808] text-white">
      {/* Animated yellow gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -right-32 top-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full opacity-80 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(48, 96%, 53%) 0%, hsl(38, 92%, 45%) 40%, transparent 70%)" }}
        />
        <div
          className="absolute -left-40 bottom-0 h-[500px] w-[500px] rounded-full opacity-60 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(38, 92%, 50%) 0%, hsl(20, 85%, 40%) 50%, transparent 75%)" }}
        />
        <div
          className="absolute right-1/3 top-10 h-[300px] w-[300px] rounded-full opacity-40 blur-[100px]"
          style={{ background: "radial-gradient(circle, hsl(54, 100%, 60%) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center px-6 lg:px-16">
        {/* Left – Card */}
        <div className="w-full lg:w-[520px] shrink-0">
          <div className="relative rounded-3xl bg-[#0f0f0f]/30 backdrop-blur-3xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] p-8 lg:p-10 overflow-hidden">
            <Link to="/" className="inline-flex items-center mb-10">
              <ThemeLogo variant="horizontal" className="h-10 object-contain" />
            </Link>

            <AnimatePresence mode="wait">
              {step === "credentials" ? (
                <motion.div
                  key="credentials"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <h1 className="text-3xl font-bold tracking-tight text-white">
                    {isLogin ? "Acesse sua conta" : "Crie sua conta"}
                  </h1>
                  <p className="mt-3 text-sm text-white/60 leading-relaxed">
                    {isLogin
                      ? "Se você já possui uma conta, preencha seus dados de acesso à plataforma."
                      : "Comece a vender produtos digitais hoje mesmo na VitraPay."}
                  </p>

                  <form onSubmit={handleSubmit} className="mt-8 space-y-3">
                    {!isLogin && (
                      <Input
                        placeholder="Seu nome"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required={!isLogin}
                        className="h-14 bg-transparent border-white/10 rounded-xl px-4 text-white placeholder:text-white/40 focus-visible:border-primary focus-visible:ring-0"
                      />
                    )}

                    <Input
                      type="email"
                      placeholder="Seu E-mail"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-14 bg-transparent border-white/10 rounded-xl px-4 text-white placeholder:text-white/40 focus-visible:border-primary focus-visible:ring-0"
                    />

                    <PasswordInput value={password} onChange={setPassword} />

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-14 mt-4 rounded-xl bg-white hover:bg-white/90 text-black text-base font-semibold flex items-center justify-center gap-2 group"
                    >
                      {loading ? "Carregando..." : (
                        <>
                          {isLogin ? "Acessar sua conta" : "Criar sua conta"}
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-sm">
                    {isLogin ? (
                      <>
                        <Link to="/" className="text-white/60 hover:text-white transition-colors font-medium">
                          Esqueceu sua senha?
                        </Link>
                        <button
                          onClick={() => setIsLogin(false)}
                          className="text-white hover:text-primary transition-colors font-medium flex items-center gap-1.5"
                        >
                          Criar uma nova conta <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsLogin(true)}
                        className="text-white/60 hover:text-white transition-colors font-medium flex items-center gap-1.5 mx-auto"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Já tenho uma conta
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <ThemeLogo variant="icon" className="h-10 w-10 object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Confirme seu e-mail</h1>
                    <p className="text-sm text-white/60 max-w-xs mx-auto">
                      Enviamos um link de confirmação para <span className="font-medium text-white">{email}</span>. Abra seu e-mail e clique no link para ativar sua conta.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center space-y-2">
                    <p className="text-xs text-white/50">Não recebeu o e-mail? Verifique sua caixa de spam ou clique abaixo para reenviar.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={countdown > 0 || loading}
                      onClick={handleResendOtp}
                      className="bg-transparent border-white/10 text-white hover:bg-white/5"
                    >
                      {countdown > 0 ? `Reenviar em ${countdown}s` : "Reenviar e-mail"}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full text-white/70 hover:text-white hover:bg-white/5"
                    onClick={() => { setStep("credentials"); setOtp(""); }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao cadastro
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right – Big headline */}
        <div className="hidden lg:flex flex-1 items-center justify-center pl-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
            className="relative"
          >
            <h2 className="text-white font-bold tracking-tight leading-[0.95] text-[clamp(4rem,9vw,9rem)]">
              Você<br />é único.
            </h2>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
