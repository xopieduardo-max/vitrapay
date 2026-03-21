import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Camera, LogOut, Loader2, Save, KeyRound, User, Palette, Bell, BellOff, Plug, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
      }
      return data;
    },
    enabled: !!user,
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar foto.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl + "?t=" + Date.now() })
      .eq("user_id", user.id);

    if (updateError) {
      toast.error("Erro ao atualizar perfil.");
    } else {
      toast.success("Foto atualizada!");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    }
    setUploading(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao salvar perfil.");
    } else {
      toast.success("Perfil atualizado!");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const initials = (displayName || user?.email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu perfil e configurações da conta</p>
      </div>

      {/* Profile Section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-primary" />
          Perfil
        </div>

        <div className="flex items-center gap-5">
          <div className="relative group">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName || "Sem nome"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nome de exibição</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
              className="bg-muted/50 border-transparent focus:border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre você..."
              className="bg-muted/50 border-transparent focus:border-border resize-none"
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Perfil
            </Button>
          </div>
        </div>
      </div>

      {/* Theme Section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="h-4 w-4 text-primary" />
          Aparência
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Tema da interface</p>
            <p className="text-xs text-muted-foreground mt-0.5">Alterne entre modo claro e escuro</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Push Notifications Section */}
      <NotificationsSection />

      {/* Integrations Section */}
      <IntegrationsSection />

      {/* Password Section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" />
          Alterar Senha
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="bg-muted/50 border-transparent focus:border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="bg-muted/50 border-transparent focus:border-border"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} size="sm" variant="outline">
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Alterar Senha
            </Button>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="rounded-xl border border-destructive/30 bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Sair da conta</p>
            <p className="text-xs text-muted-foreground mt-0.5">Você será desconectado da plataforma</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const { isSubscribed, isSupported, permission, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-primary" />
          Notificações Push
        </div>
        <p className="text-sm text-muted-foreground">
          Notificações push não são suportadas neste navegador. Para receber notificações, instale o app na tela inicial do celular.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Bell className="h-4 w-4 text-primary" />
        Notificações Push
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">Alertas de venda no celular</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSubscribed
              ? "Você está recebendo notificações a cada nova venda"
              : "Ative para receber alertas instantâneos de vendas"}
          </p>
        </div>
        {isSubscribed ? (
          <Button variant="outline" size="sm" onClick={unsubscribe}>
            <BellOff className="h-4 w-4 mr-2" />
            Desativar
          </Button>
        ) : (
          <Button size="sm" onClick={subscribe}>
            <Bell className="h-4 w-4 mr-2" />
            Ativar
          </Button>
        )}
      </div>
      {permission === "denied" && (
        <p className="text-xs text-destructive">
          Notificações bloqueadas pelo navegador. Vá nas configurações do navegador para permitir.
        </p>
      )}
    </div>
  );
}

function IntegrationsSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [utmifyToken, setUtmifyToken] = useState("");
  const [utmifyActive, setUtmifyActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: integration, isLoading } = useQuery({
    queryKey: ["user-integrations", user?.id, "utmify"],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("platform", "utmify")
        .maybeSingle();
      if (data && !loaded) {
        setUtmifyToken(data.api_token || "");
        setUtmifyActive(data.is_active);
        setLoaded(true);
      }
      return data;
    },
    enabled: !!user,
  });

  const handleSave = async () => {
    if (!user) return;
    if (!utmifyToken.trim()) {
      toast.error("Informe o token do UTMify.");
      return;
    }
    setSaving(true);

    if (integration) {
      const { error } = await supabase
        .from("user_integrations")
        .update({ api_token: utmifyToken.trim(), is_active: utmifyActive, updated_at: new Date().toISOString() })
        .eq("id", integration.id);
      if (error) toast.error("Erro ao atualizar integração.");
      else toast.success("Integração atualizada!");
    } else {
      const { error } = await supabase
        .from("user_integrations")
        .insert({ user_id: user.id, platform: "utmify", api_token: utmifyToken.trim(), is_active: utmifyActive });
      if (error) toast.error("Erro ao salvar integração.");
      else toast.success("Integração configurada!");
    }

    queryClient.invalidateQueries({ queryKey: ["user-integrations", user.id, "utmify"] });
    setSaving(false);
  };

  const handleRemove = async () => {
    if (!integration) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_integrations")
      .delete()
      .eq("id", integration.id);
    if (error) toast.error("Erro ao remover.");
    else {
      toast.success("Integração removida!");
      setUtmifyToken("");
      setUtmifyActive(true);
      setLoaded(false);
    }
    queryClient.invalidateQueries({ queryKey: ["user-integrations", user?.id, "utmify"] });
    setSaving(false);
  };

  if (isLoading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Plug className="h-4 w-4 text-primary" />
        Integrações
      </div>

      {/* UTMify */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">UTMify</p>
            <p className="text-xs text-muted-foreground">Rastreie vendas e UTMs automaticamente</p>
          </div>
          <Switch checked={utmifyActive} onCheckedChange={setUtmifyActive} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Token de API</Label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              value={utmifyToken}
              onChange={(e) => setUtmifyToken(e.target.value)}
              placeholder="Cole seu token do UTMify aqui"
              className="bg-muted/50 border-transparent focus:border-border pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Encontre em app.utmify.com.br → Integrações → Credenciais de API
          </p>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {integration && (
            <Button variant="outline" size="sm" onClick={handleRemove} disabled={saving}>
              Remover
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !utmifyToken.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {integration ? "Atualizar" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}