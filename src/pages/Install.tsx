import { useState, useEffect } from "react";
import { Smartphone, Apple, MonitorSmartphone, Share, PlusSquare, MoreVertical, Download, CheckCircle2, ArrowLeft, ChevronRight, Zap, Bell, Wifi, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import appMockup from "@/assets/app-mockup.png";
import { IPhoneFrame } from "@/components/IPhoneFrame";

type Platform = "ios" | "android" | null;

function detectPlatform(): Platform {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

const iosSteps = [
  {
    icon: Share,
    title: "Abra no Safari",
    description: "Certifique-se de estar usando o navegador Safari. Toque no ícone de compartilhamento na barra inferior (quadrado com seta ↑).",
    visual: "safari-share",
    tip: "Se estiver no Chrome ou outro navegador, copie o link e abra no Safari.",
  },
  {
    icon: PlusSquare,
    title: "Adicionar à Tela de Início",
    description: "Role para baixo nas opções e toque em \"Adicionar à Tela de Início\".",
    visual: "add-home",
    tip: null,
  },
  {
    icon: CheckCircle2,
    title: "Confirme a instalação",
    description: "Toque em \"Adicionar\" no canto superior direito. Pronto! O ícone do app aparecerá na sua tela inicial.",
    visual: "confirm",
    tip: null,
  },
];

const androidSteps = [
  {
    icon: MoreVertical,
    title: "Abra no Chrome",
    description: "Use o Google Chrome. Toque nos 3 pontinhos (⋮) no canto superior direito da tela.",
    visual: "chrome-menu",
    tip: "Funciona melhor no Chrome. Outros navegadores podem não ter essa opção.",
  },
  {
    icon: Download,
    title: "Instalar aplicativo",
    description: "No menu, toque em \"Instalar aplicativo\" ou \"Adicionar à tela inicial\".",
    visual: "install-app",
    tip: null,
  },
  {
    icon: CheckCircle2,
    title: "Confirme a instalação",
    description: "Toque em \"Instalar\" na janela que aparecer. O app será baixado e instalado automaticamente!",
    visual: "confirm",
    tip: null,
  },
];

const visualIcons: Record<string, string> = {
  "safari-share": "↑",
  "add-home": "+",
  "confirm": "✓",
  "chrome-menu": "⋮",
  "install-app": "⬇",
};

function StepCard({ step, index, isActive, onClick }: { 
  step: typeof iosSteps[0]; 
  index: number; 
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12, type: "spring", stiffness: 200 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
        isActive 
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" 
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      {/* Step number badge */}
      <div className="absolute top-0 right-0 w-12 h-12">
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[48px] border-l-transparent border-t-[48px] border-t-primary/10" />
        <span className="absolute top-1.5 right-3 text-xs font-bold text-primary">
          {index + 1}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex gap-4 items-start">
          {/* Visual icon circle */}
          <div className={`flex items-center justify-center h-14 w-14 rounded-2xl shrink-0 transition-all duration-300 ${
            isActive 
              ? "bg-primary text-primary-foreground shadow-md" 
              : "bg-muted text-muted-foreground"
          }`}>
            <span className="text-2xl font-bold">{visualIcons[step.visual]}</span>
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground mb-1">{step.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
          </div>
        </div>

        {/* Expandable tip */}
        <AnimatePresence>
          {isActive && step.tip && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 border border-warning/20 p-3">
                <span className="text-sm shrink-0">💡</span>
                <p className="text-xs text-foreground/80 leading-relaxed">{step.tip}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress connector */}
      {index < 2 && (
        <div className="absolute -bottom-4 left-7 w-0.5 h-4 bg-border z-10" />
      )}
    </motion.div>
  );
}

const benefits = [
  { icon: Zap, text: "Acesso instantâneo", desc: "Abra direto da tela inicial" },
  { icon: Bell, text: "Notificações de vendas", desc: "Saiba cada venda em tempo real" },
  { icon: Wifi, text: "Funciona offline", desc: "Acesse mesmo sem internet" },
  { icon: Rocket, text: "Super rápido", desc: "Carrega mais rápido que o navegador" },
];

export default function Install() {
  const [selected, setSelected] = useState<Platform>(null);
  const detectedPlatform = detectPlatform();
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(mq.matches);
  }, []);

  const activePlatform = selected ?? detectedPlatform ?? "android";
  const steps = activePlatform === "ios" ? iosSteps : androidSteps;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-lg">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <MonitorSmartphone className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">Instalar App</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-lg mx-auto w-full">
        {isInstalled ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-4 py-12"
          >
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">App já instalado!</h1>
            <p className="text-sm text-muted-foreground">
              O VitraPay já está instalado no seu dispositivo. Aproveite!
            </p>
            <Link to="/dashboard">
              <Button className="mt-4">Ir para o Dashboard</Button>
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Hero with phone mockup */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4 mb-6"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="relative mx-auto w-40 sm:w-48"
              >
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75" />
                <img
                  src={appMockup}
                  alt="App VitraPay no celular"
                  className="relative w-full drop-shadow-2xl"
                />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Instale o VitraPay
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Adicione o app à sua tela inicial em <strong className="text-foreground">3 passos simples</strong>
                </p>
              </div>
            </motion.div>

            {/* Platform selector */}
            <div className="flex gap-2 mb-2 w-full">
              <Button
                variant={activePlatform === "ios" ? "default" : "outline"}
                className="flex-1 gap-2 h-12 rounded-xl text-sm font-semibold"
                onClick={() => { setSelected("ios"); setActiveStep(0); }}
              >
                <Apple className="h-5 w-5" />
                iPhone / iPad
              </Button>
              <Button
                variant={activePlatform === "android" ? "default" : "outline"}
                className="flex-1 gap-2 h-12 rounded-xl text-sm font-semibold"
                onClick={() => { setSelected("android"); setActiveStep(0); }}
              >
                <Smartphone className="h-5 w-5" />
                Android
              </Button>
            </div>

            {/* Auto-detect note */}
            {detectedPlatform && !selected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-xs text-muted-foreground mb-4 bg-muted/50 px-3 py-2 rounded-lg"
              >
                <span>📱</span>
                <span>Detectamos: <strong className="text-foreground">{detectedPlatform === "ios" ? "iPhone / iPad" : "Android"}</strong></span>
              </motion.div>
            )}

            {/* Section title */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-full flex items-center gap-3 mb-4 mt-2"
            >
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Passo a passo
              </span>
              <div className="h-px flex-1 bg-border" />
            </motion.div>

            {/* Steps */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activePlatform}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full space-y-4"
              >
                {steps.map((step, i) => (
                  <StepCard 
                    key={step.title} 
                    step={step} 
                    index={i} 
                    isActive={activeStep === i}
                    onClick={() => setActiveStep(i)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Step navigation hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-[0.65rem] text-muted-foreground mt-3 flex items-center gap-1"
            >
              <ChevronRight className="h-3 w-3" />
              Toque em cada passo para ver dicas
            </motion.p>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-8 w-full space-y-3"
            >
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center">
                Por que instalar?
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {benefits.map((b, i) => {
                  const Icon = b.icon;
                  return (
                    <motion.div
                      key={b.text}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.08 }}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-card text-center"
                    >
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{b.text}</span>
                      <span className="text-[0.65rem] text-muted-foreground leading-tight">{b.desc}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* iOS push note */}
            {activePlatform === "ios" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-4 flex items-start gap-2 rounded-xl bg-info/10 border border-info/20 p-3 w-full"
              >
                <span className="text-sm shrink-0">ℹ️</span>
                <p className="text-[0.7rem] text-foreground/80 leading-relaxed">
                  No iPhone, as notificações push funcionam a partir do <strong>iOS 16.4</strong> com o app instalado na tela inicial.
                </p>
              </motion.div>
            )}

            {/* Final CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-6 mb-4 text-center"
            >
              <p className="text-xs text-muted-foreground mb-3">
                Já instalou? Acesse seu painel:
              </p>
              <Link to="/dashboard">
                <Button variant="outline" className="rounded-xl gap-2">
                  Ir para o Dashboard
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
