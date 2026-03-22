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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, LogOut, Loader2, Save, KeyRound, User, Palette, Bell, BellOff, Landmark } from "lucide-react";
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
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [saving, setSaving] = useState(false);
  const [savingPix, setSavingPix] = useState(false);
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
        setPixKey((data as any).pix_key || "");
        setPixKeyType((data as any).pix_key_type || "cpf");
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

      {/* Pix Key Section */}
      <PixKeySection
        pixKey={pixKey}
        setPixKey={setPixKey}
        pixKeyType={pixKeyType}
        setPixKeyType={setPixKeyType}
        savingPix={savingPix}
        onSave={async () => {
          if (!user) return;
          setSavingPix(true);
          const { error } = await supabase
            .from("profiles")
            .update({ pix_key: pixKey, pix_key_type: pixKeyType } as any)
            .eq("user_id", user.id);
          if (error) toast.error("Erro ao salvar chave Pix.");
          else {
            toast.success("Chave Pix salva!");
            queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
          }
          setSavingPix(false);
        }}
      />

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

function PixKeySection({
  pixKey,
  setPixKey,
  pixKeyType,
  setPixKeyType,
  savingPix,
  onSave,
}: {
  pixKey: string;
  setPixKey: (v: string) => void;
  pixKeyType: string;
  setPixKeyType: (v: string) => void;
  savingPix: boolean;
  onSave: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Landmark className="h-4 w-4 text-primary" />
        Chave Pix para Saques
      </div>
      <p className="text-xs text-muted-foreground">
        Configure sua chave Pix para receber saques. Ela será usada automaticamente ao solicitar um saque.
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Tipo de chave</Label>
          <Select value={pixKeyType} onValueChange={setPixKeyType}>
            <SelectTrigger className="bg-muted/50 border-transparent focus:border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="random">Chave aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Chave Pix</Label>
          <Input
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="Sua chave Pix"
            className="bg-muted/50 border-transparent focus:border-border"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={savingPix || !pixKey.trim()} size="sm">
            {savingPix ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Chave Pix
          </Button>
        </div>
      </div>
    </div>
  );
}
