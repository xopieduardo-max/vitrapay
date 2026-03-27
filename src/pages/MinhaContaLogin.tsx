import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Lock, User } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeLogo } from "@/components/ThemeLogo";

type View = "login" | "register" | "forgot";

export default function MinhaContaLogin({ onAuth }: { onAuth: () => void }) {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onAuth();
    } catch (error: any) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name }, emailRedirectTo: window.location.origin + "/minha-conta" },
      });
      if (error) throw error;
      toast({ title: "Cadastro realizado!", description: "Verifique seu e-mail para confirmar a conta." });
      setView("login");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/minha-conta",
      });
      if (error) throw error;
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
      setView("login");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="flex flex-col items-center space-y-4">
          <Link to="/">
            <ThemeLogo variant="horizontal" className="h-12 object-contain" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Minha Conta</h1>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <AnimatePresence mode="wait">
            {view === "login" && (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <h2 className="text-lg font-semibold">Entrar</h2>
                  <p className="text-sm text-muted-foreground">Acesse seus produtos comprados</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Use o e-mail da compra e os 6 primeiros dígitos do seu CPF como senha</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10 h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-10 h-11" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setView("forgot")} className="text-primary hover:underline">Esqueci minha senha</button>
                  <button type="button" onClick={() => setView("register")} className="text-primary hover:underline">Criar conta</button>
                </div>
              </motion.form>
            )}

            {view === "register" && (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <h2 className="text-lg font-semibold">Criar Conta</h2>
                  <p className="text-sm text-muted-foreground">Use o mesmo e-mail da sua compra</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required className="pl-10 h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="reg-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10 h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="reg-password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-10 h-11" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Criando..." : "Criar Conta"}
                </Button>
                <button type="button" onClick={() => setView("login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto">
                  <ArrowLeft className="h-3 w-3" /> Voltar ao login
                </button>
              </motion.form>
            )}

            {view === "forgot" && (
              <motion.form
                key="forgot"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleForgotPassword}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <h2 className="text-lg font-semibold">Recuperar Senha</h2>
                  <p className="text-sm text-muted-foreground">Enviaremos um link de redefinição</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="forgot-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10 h-11" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar link"}
                </Button>
                <button type="button" onClick={() => setView("login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto">
                  <ArrowLeft className="h-3 w-3" /> Voltar ao login
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Use o mesmo e-mail utilizado na compra para acessar seus produtos.
        </p>
      </motion.div>
    </div>
  );
}
