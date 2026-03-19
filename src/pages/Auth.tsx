import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import authBanner from "@/assets/auth-banner.png";

type Step = "credentials" | "otp";

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

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setStep("otp");
        setCountdown(60);
        toast({
          title: "Código enviado!",
          description: "Verifique seu e-mail e insira o código de 6 dígitos.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
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
      toast({ title: "Conta confirmada!", description: "Bem-vindo à Aether." });
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left – Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md space-y-8">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
            </div>
            <span className="text-xl font-bold tracking-tight">Aether</span>
          </Link>

          <AnimatePresence mode="wait">
            {step === "credentials" ? (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {isLogin ? "Entrar na sua conta" : "Criar sua conta"}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isLogin
                      ? "Insira seus dados abaixo para continuar sua jornada na Aether"
                      : "Comece a vender produtos digitais hoje mesmo"}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm">Nome</Label>
                      <Input
                        id="name"
                        placeholder="Seu nome"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required={!isLogin}
                        className="h-12"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-12"
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                    {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar Conta"}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-primary font-medium hover:underline"
                  >
                    {isLogin ? "Cadastre-se" : "Faça login"}
                  </button>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">Confirme seu e-mail</h1>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Enviamos um link de confirmação para <span className="font-medium text-foreground">{email}</span>. Abra seu e-mail e clique no link para ativar sua conta.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">Não recebeu o e-mail? Verifique sua caixa de spam ou clique abaixo para reenviar.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={countdown > 0 || loading}
                    onClick={handleResendOtp}
                  >
                    {countdown > 0 ? `Reenviar em ${countdown}s` : "Reenviar e-mail"}
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => { setStep("credentials"); setOtp(""); }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao cadastro
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <Link
            to="/"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar ao início
          </Link>
        </div>
      </div>

      {/* Right – Banner (hidden on mobile) */}
      <div className="hidden lg:block lg:flex-1 relative overflow-hidden">
        <img
          src={authBanner}
          alt="Aether — Acelerando rumo ao futuro"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
      </div>
    </div>
  );
}
