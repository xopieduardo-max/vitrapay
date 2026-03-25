import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Camera, Loader2, Save, KeyRound, User, Bell, BellOff, Landmark,
  ShieldCheck, MapPin, Phone,
} from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const { user } = useAuth();
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

  // Verification fields
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [addressCep, setAddressCep] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [savingVerification, setSavingVerification] = useState(false);

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
        setPixKey(data.pix_key || "");
        setPixKeyType(data.pix_key_type || "cpf");
        setCpf((data as any).cpf || "");
        setPhone((data as any).phone || "");
        setBirthDate((data as any).birth_date || "");
        
        setAddressCep((data as any).address_cep || "");
        setAddressStreet((data as any).address_street || "");
        setAddressNumber((data as any).address_number || "");
        setAddressComplement((data as any).address_complement || "");
        setAddressNeighborhood((data as any).address_neighborhood || "");
        setAddressCity((data as any).address_city || "");
        setAddressState((data as any).address_state || "");
      }
      return data;
    },
    enabled: !!user,
  });

  const isVerified = !!(profile as any)?.profile_verified;

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
      queryClient.invalidateQueries({ queryKey: ["profile-header", user.id] });
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
      queryClient.invalidateQueries({ queryKey: ["profile-header", user.id] });
    }
    setSaving(false);
  };

  const handleSaveVerification = async () => {
    if (!user) return;
    if (!cpf.trim() || !phone.trim() || !addressCep.trim() || !addressStreet.trim() || !addressNumber.trim() || !addressCity.trim() || !addressState.trim()) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setSavingVerification(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        cpf,
        phone,
        birth_date: birthDate || null,
        address_cep: addressCep,
        address_street: addressStreet,
        address_number: addressNumber,
        address_complement: addressComplement,
        address_neighborhood: addressNeighborhood,
        address_city: addressCity,
        address_state: addressState,
        profile_verified: true,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
      } as any)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao salvar dados.");
    } else {
      toast.success("Dados verificados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    }
    setSavingVerification(false);
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

  const initials = (displayName || user?.email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const ESTADOS = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
    "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus dados e configurações</p>
        </div>
        {isVerified ? (
          <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10">
            <ShieldCheck className="h-3.5 w-3.5" /> Verificado
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 text-amber-500 border-amber-500/30">
            Pendente de verificação
          </Badge>
        )}
      </div>

      {/* Profile Section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-primary" />
          Dados do Perfil
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
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome" className="bg-muted/50 border-transparent focus:border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte um pouco sobre você..." className="bg-muted/50 border-transparent focus:border-border resize-none" rows={3} />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Perfil
            </Button>
          </div>
        </div>
      </div>

      {/* Verification Section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Verificação de Identidade
          {!isVerified && (
            <span className="text-xs text-amber-500 font-normal ml-auto">Obrigatório para vender</span>
          )}
        </div>

        <div className="space-y-4">
          {/* Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">CPF <span className="text-destructive">*</span></Label>
              <Input
                value={cpf}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                  const formatted = val
                    .replace(/(\d{3})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                  setCpf(formatted);
                }}
                placeholder="000.000.000-00"
                className="bg-muted/50 border-transparent focus:border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Data de nascimento</Label>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="bg-muted/50 border-transparent focus:border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> Telefone <span className="text-destructive">*</span>
            </Label>
            <Input
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                let formatted = val;
                if (val.length > 7) {
                  formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
                } else if (val.length > 2) {
                  formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                }
                setPhone(formatted);
              }}
              placeholder="(11) 99999-9999"
              className="bg-muted/50 border-transparent focus:border-border"
            />
          </div>

          {/* Address */}
          <div className="pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <MapPin className="h-4 w-4 text-primary" />
              Endereço
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">CEP <span className="text-destructive">*</span></Label>
                <Input
                  value={addressCep}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                    const formatted = val.length > 5 ? `${val.slice(0, 5)}-${val.slice(5)}` : val;
                    setAddressCep(formatted);
                    if (val.length === 8) {
                      fetch(`https://viacep.com.br/ws/${val}/json/`)
                        .then((r) => r.json())
                        .then((d) => {
                          if (!d.erro) {
                            setAddressStreet(d.logradouro || "");
                            setAddressNeighborhood(d.bairro || "");
                            setAddressCity(d.localidade || "");
                            setAddressState(d.uf || "");
                          }
                        })
                        .catch(() => {});
                    }
                  }}
                  placeholder="00000-000"
                  className="bg-muted/50 border-transparent focus:border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Estado <span className="text-destructive">*</span></Label>
                <Select value={addressState} onValueChange={setAddressState}>
                  <SelectTrigger className="bg-muted/50 border-transparent focus:border-border">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Rua <span className="text-destructive">*</span></Label>
                <Input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="Rua, Avenida, Alameda" className="bg-muted/50 border-transparent focus:border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Número <span className="text-destructive">*</span></Label>
                <Input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="Nº" className="bg-muted/50 border-transparent focus:border-border" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Complemento</Label>
                <Input value={addressComplement} onChange={(e) => setAddressComplement(e.target.value)} placeholder="Ap, Bloco" className="bg-muted/50 border-transparent focus:border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Bairro</Label>
                <Input value={addressNeighborhood} onChange={(e) => setAddressNeighborhood(e.target.value)} placeholder="Bairro" className="bg-muted/50 border-transparent focus:border-border" />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Cidade <span className="text-destructive">*</span></Label>
              <Input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Cidade" className="bg-muted/50 border-transparent focus:border-border" />
            </div>
          </div>

          {/* Pix Key inside verification */}
          <div className="pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <Landmark className="h-4 w-4 text-primary" />
              Chave Pix para Saques
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              A chave Pix deve estar vinculada ao seu CPF. Ela será usada para receber seus saques.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Sua chave Pix" className="bg-muted/50 border-transparent focus:border-border" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveVerification} disabled={savingVerification} size="sm">
              {savingVerification ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              {isVerified ? "Atualizar Dados" : "Verificar e Salvar"}
            </Button>
          </div>
        </div>
      </div>

      <NotificationsSection />

      {/* Password Section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" />
          Alterar Senha
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nova senha</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-muted/50 border-transparent focus:border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Confirmar nova senha</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" className="bg-muted/50 border-transparent focus:border-border" />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} size="sm" variant="outline">
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Alterar Senha
            </Button>
          </div>
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
