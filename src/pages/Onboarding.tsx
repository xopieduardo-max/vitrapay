import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThemeLogo } from "@/components/ThemeLogo";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Rocket, CheckCircle2, ChevronRight, ChevronLeft,
  DollarSign, Globe, Megaphone, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AccountType = "buyer" | "producer";

interface SurveyData {
  account_type: AccountType | null;
  already_sells: boolean | null;
  monthly_revenue: string | null;
  current_platform: string | null;
  referral_source: string | null;
}

const PLATFORMS = [
  "Hotmart", "Kiwify", "Braip", "Kirvano", "Cacto", "Eduzz", "Ticto",
  "Monetizze", "Nenhuma", "Outra",
];

const REVENUES = [
  "Ainda não faturei",
  "Até R$ 5.000/mês",
  "R$ 5.000 – R$ 20.000/mês",
  "R$ 20.000 – R$ 50.000/mês",
  "R$ 50.000 – R$ 100.000/mês",
  "Acima de R$ 100.000/mês",
];

const REFERRALS = [
  "Instagram", "YouTube", "Facebook", "TikTok", "Google",
  "Influenciador / Infoprodutor", "Amigo / Indicação", "Outro",
];

function OptionCard({
  selected,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: any;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
        selected
          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
          : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/40"
      )}
    >
      {Icon && (
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0",
          selected ? "bg-primary/20" : "bg-muted"
        )}>
          <Icon className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground")} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", selected && "text-primary")}>{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {selected && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
    </button>
  );
}

function ChipOption({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium border transition-all duration-200",
        selected
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
          : "border-border bg-card text-foreground hover:border-muted-foreground/30"
      )}
    >
      {label}
    </button>
  );
}

const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SurveyData>({
    account_type: null,
    already_sells: null,
    monthly_revenue: null,
    current_platform: null,
    referral_source: null,
  });

  const totalSteps = data.account_type === "producer" ? 5 : 2;

  const canNext = () => {
    switch (step) {
      case 0: return !!data.account_type;
      case 1: return data.account_type === "buyer" || data.already_sells !== null;
      case 2: return !!data.monthly_revenue;
      case 3: return !!data.current_platform;
      case 4: return !!data.referral_source;
      default: return false;
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updateData: any = {
        account_type: data.account_type,
        referral_source: data.referral_source,
        onboarding_completed: true,
      };
      if (data.account_type === "producer") {
        updateData.already_sells = data.already_sells;
        updateData.monthly_revenue = data.monthly_revenue;
        updateData.current_platform = data.current_platform;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);
      if (error) throw error;

      // If producer, add role
      if (data.account_type === "producer") {
        await supabase.from("user_roles").insert({ user_id: user.id, role: "producer" });
      }

      // Invalidate AuthGuard cache so it knows onboarding is done
      await queryClient.invalidateQueries({ queryKey: ["onboarding-check", user.id] });

      toast({ title: "Bem-vindo à VitraPay! 🚀" });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    // Buyer skips producer questions, goes to referral then finish
    if (data.account_type === "buyer" && step === 0) {
      setStep(4); // jump to referral
      return;
    }
    if (step >= totalSteps - 1) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (data.account_type === "buyer" && step === 4) {
      setStep(0);
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  const progress = data.account_type === "buyer"
    ? step === 0 ? 50 : 100
    : ((step + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <ThemeLogo variant="horizontal" className="h-10 object-contain" />
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Configure seu perfil
          </p>
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold">O que você quer fazer na VitraPay?</h2>
                <p className="text-sm text-muted-foreground">Escolha o que mais combina com você</p>
              </div>
              <div className="space-y-3">
                <OptionCard
                  selected={data.account_type === "buyer"}
                  onClick={() => setData({ ...data, account_type: "buyer" })}
                  icon={ShoppingBag}
                  label="Quero comprar"
                  description="Comprar produtos digitais, cursos e conteúdos"
                />
                <OptionCard
                  selected={data.account_type === "producer"}
                  onClick={() => setData({ ...data, account_type: "producer" })}
                  icon={Rocket}
                  label="Quero vender"
                  description="Vender meus produtos digitais e infoprodutos"
                />
              </div>
            </motion.div>
          )}

          {step === 1 && data.account_type === "producer" && (
            <motion.div key="s1" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold">Você já vende online?</h2>
                <p className="text-sm text-muted-foreground">Queremos entender melhor seu momento</p>
              </div>
              <div className="space-y-3">
                <OptionCard
                  selected={data.already_sells === true}
                  onClick={() => setData({ ...data, already_sells: true })}
                  icon={CheckCircle2}
                  label="Sim, já vendo"
                  description="Já tenho experiência vendendo produtos digitais"
                />
                <OptionCard
                  selected={data.already_sells === false}
                  onClick={() => setData({ ...data, already_sells: false })}
                  icon={Rocket}
                  label="Ainda não, quero começar"
                  description="Estou começando agora no mercado digital"
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="space-y-4">
              <div className="text-center space-y-1">
                <DollarSign className="h-8 w-8 mx-auto text-primary" />
                <h2 className="text-xl font-bold">Qual seu faturamento mensal?</h2>
                <p className="text-sm text-muted-foreground">Aproximadamente, com produtos digitais</p>
              </div>
              <div className="space-y-2">
                {REVENUES.map((r) => (
                  <OptionCard
                    key={r}
                    selected={data.monthly_revenue === r}
                    onClick={() => setData({ ...data, monthly_revenue: r })}
                    label={r}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="space-y-4">
              <div className="text-center space-y-1">
                <Globe className="h-8 w-8 mx-auto text-primary" />
                <h2 className="text-xl font-bold">Qual plataforma você usa hoje?</h2>
                <p className="text-sm text-muted-foreground">Selecione sua plataforma principal</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {PLATFORMS.map((p) => (
                  <ChipOption
                    key={p}
                    selected={data.current_platform === p}
                    onClick={() => setData({ ...data, current_platform: p })}
                    label={p}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="space-y-4">
              <div className="text-center space-y-1">
                <Megaphone className="h-8 w-8 mx-auto text-primary" />
                <h2 className="text-xl font-bold">Como conheceu a VitraPay?</h2>
                <p className="text-sm text-muted-foreground">Nos ajude a melhorar nossa divulgação</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {REFERRALS.map((r) => (
                  <ChipOption
                    key={r}
                    selected={data.referral_source === r}
                    onClick={() => setData({ ...data, referral_source: r })}
                    label={r}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          {step > 0 && (
            <Button variant="ghost" onClick={handleBack} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
          )}
          <div className="flex-1" />
          <Button
            onClick={handleNext}
            disabled={!canNext() || saving}
            className="gap-1 min-w-[140px]"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step >= totalSteps - 1 || (data.account_type === "buyer" && step === 4) ? (
              "Começar! 🚀"
            ) : (
              <>Próximo <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
