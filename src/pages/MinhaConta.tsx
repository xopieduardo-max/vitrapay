import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, BookOpen, Play, LogOut, Package, AlertTriangle, Lock, Eye, EyeOff, Check, PartyPopper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ThemeLogo } from "@/components/ThemeLogo";
import { useToast } from "@/hooks/use-toast";
import MinhaContaLogin from "./MinhaContaLogin";

export default function MinhaConta() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [authTrigger, setAuthTrigger] = useState(0);
  const { toast } = useToast();

  const isAutoCreated = user?.user_metadata?.auto_created === true;
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "A nova senha e a confirmação devem ser iguais.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { auto_created: false } });
      await supabase.from("profiles").update({ must_change_password: false }).eq("user_id", user!.id);
      setPasswordChanged(true);
      setShowPasswordChange(false);
      setDismissed(true);
      toast({ title: "Senha alterada!", description: "Sua nova senha foi salva com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const { data: accessItems = [], isLoading } = useQuery({
    queryKey: ["minha-conta-products", user?.id, user?.email, authTrigger],
    queryFn: async () => {
      if (!user) return [];

      const { data: accessById } = await supabase
        .from("product_access")
        .select("id, product_id, granted_at, sale_id")
        .eq("user_id", user.id)
        .order("granted_at", { ascending: false });

      const { data: accessByEmail } = await supabase
        .from("product_access")
        .select("id, product_id, granted_at, sale_id")
        .eq("buyer_email", user.email!)
        .order("granted_at", { ascending: false });

      const allAccess = [...(accessById || []), ...(accessByEmail || [])];
      const seen = new Set<string>();
      const access = allAccess.filter((a) => {
        if (seen.has(a.product_id)) return false;
        seen.add(a.product_id);
        return true;
      });

      if (!access.length) return [];

      const emailOnly = (accessByEmail || []).filter((a: any) => !a.user_id || a.user_id !== user.id);
      if (emailOnly.length > 0) {
        for (const item of emailOnly) {
          await supabase.from("product_access").update({ user_id: user.id }).eq("id", item.id);
        }
      }

      const productIds = access.map((a) => a.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, title, description, type, cover_url, file_url, producer_id")
        .in("id", productIds);

      if (!products?.length) return [];

      // Fetch product files for download products
      const downloadProductIds = products.filter(p => p.type === "download").map(p => p.id);
      let productFilesMap: Record<string, any[]> = {};
      if (downloadProductIds.length > 0) {
        const { data: files } = await supabase
          .from("product_files")
          .select("*")
          .in("product_id", downloadProductIds)
          .order("position");
        if (files) {
          files.forEach((f: any) => {
            if (!productFilesMap[f.product_id]) productFilesMap[f.product_id] = [];
            productFilesMap[f.product_id].push(f);
          });
        }
      }

      const producerIds = [...new Set(products.map((p) => p.producer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", producerIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));
      const productMap = new Map(products.map((p) => [p.id, p]));

      return access.map((a) => {
        const product = productMap.get(a.product_id);
        return {
          ...a,
          product: product
            ? {
                ...product,
                producerName: profileMap.get(product.producer_id) || "Produtor",
                files: productFilesMap[product.id] || [],
              }
            : null,
        };
      }).filter((a) => a.product);
    },
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <MinhaContaLogin onAuth={() => setAuthTrigger((t) => t + 1)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/">
            <ThemeLogo variant="horizontal" className="h-8 object-contain" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome Banner */}
        {accessItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <PartyPopper className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Parabéns pela sua compra!
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Aproveite seus produtos abaixo. Seus arquivos e cursos estão prontos para acesso.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acesse os produtos que você comprou
          </p>
        </div>

        {/* Password change banner for auto-created accounts */}
        <AnimatePresence>
          {isAutoCreated && !dismissed && !passwordChanged && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border-2 border-accent bg-accent/10 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-accent-foreground" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="font-semibold text-sm text-foreground">Troque sua senha provisória</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sua conta foi criada automaticamente na compra. Por segurança, recomendamos que você defina uma nova senha.
                    </p>
                  </div>

                  {!showPasswordChange ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowPasswordChange(true)}>
                        <Lock className="h-3.5 w-3.5" />
                        Trocar Senha Agora
                      </Button>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 pt-1"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="new-pass" className="text-xs">Nova senha</Label>
                        <div className="relative">
                          <Input
                            id="new-pass"
                            type={showPass ? "text" : "password"}
                            placeholder="Mínimo 6 caracteres"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="h-9 text-sm pr-9"
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="confirm-pass" className="text-xs">Confirmar senha</Label>
                        <Input
                          id="confirm-pass"
                          type={showPass ? "text" : "password"}
                          placeholder="Repita a nova senha"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-9 text-sm"
                          minLength={6}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={handlePasswordChange}
                          disabled={changingPassword || newPassword.length < 6}
                        >
                          {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          {changingPassword ? "Salvando..." : "Salvar Nova Senha"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowPasswordChange(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : accessItems.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </div>
            <div>
              <p className="font-medium text-foreground">Nenhum produto encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você ainda não comprou nenhum produto ou o e-mail da compra é diferente do seu login.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accessItems.map((item: any, i: number) => {
              const product = item.product;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease: [0.2, 0, 0, 1] }}
                  className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-video w-full flex items-center justify-center bg-muted/30 overflow-hidden">
                    {product.cover_url ? (
                      <img src={product.cover_url} alt={product.title} className="w-full h-full object-cover" />
                    ) : product.type === "download" ? (
                      <Download className="h-10 w-10 text-foreground/10" strokeWidth={1.5} />
                    ) : (
                      <BookOpen className="h-10 w-10 text-foreground/10" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-sm">{product.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{product.producerName}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <Badge variant="outline" className="text-[0.65rem]">
                        {product.type === "download" ? "Download" : "Curso"}
                      </Badge>
                      {product.type === "download" ? (
                        <Button size="sm" className="gap-1.5 h-8 text-xs" asChild>
                          <Link to={`/minha-conta/download/${product.id}`}>
                            <Download className="h-3.5 w-3.5" />
                            {product.files?.length > 1 ? `${product.files.length} Arquivos` : "Baixar"}
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" className="gap-1.5 h-8 text-xs" asChild>
                          <Link to={`/learn/${product.id}`}>
                            <Play className="h-3.5 w-3.5" />
                            Acessar
                          </Link>
                        </Button>
                      )}
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
