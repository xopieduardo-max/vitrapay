import { useState, useEffect, useRef } from "react";
import { Smartphone, Apple, MonitorSmartphone, Share, PlusSquare, MoreVertical, Download, CheckCircle2, ArrowLeft, Zap, Bell, Wifi, Rocket, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import iphoneMockup from "@/assets/iphone-3d-mockup.png";
import logo from "@/assets/logo-vitrapay-icon.png";

type Platform = "ios" | "android" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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
    description: "Toque no ícone de compartilhamento na barra inferior.",
    tip: "Se estiver no Chrome ou outro navegador, copie o link e abra no Safari.",
  },
  {
    icon: PlusSquare,
    title: "Adicionar à Tela de Início",
    description: 'Role para baixo e toque em "Adicionar à Tela de Início".',
    tip: null,
  },
  {
    icon: CheckCircle2,
    title: "Confirme a instalação",
    description: 'Toque em "Adicionar" no canto superior direito. Pronto!',
    tip: null,
  },
];

const androidSteps = [
  {
    icon: MoreVertical,
    title: "Abra no Chrome",
    description: "Toque nos 3 pontinhos (⋮) no canto superior direito.",
    tip: "Funciona melhor no Chrome. Outros navegadores podem não ter essa opção.",
  },
  {
    icon: Download,
    title: "Instalar aplicativo",
    description: 'No menu, toque em "Instalar aplicativo" ou "Adicionar à tela inicial".',
    tip: null,
  },
  {
    icon: CheckCircle2,
    title: "Confirme a instalação",
    description: 'Toque em "Instalar" na janela que aparecer.',
    tip: null,
  },
];

const benefits = [
  { icon: Zap, text: "Acesso instantâneo", desc: "Abra direto da tela inicial" },
  { icon: Bell, text: "Notificações", desc: "Saiba cada venda em tempo real" },
  { icon: Wifi, text: "Funciona offline", desc: "Acesse mesmo sem internet" },
  { icon: Rocket, text: "Super rápido", desc: "Mais rápido que o navegador" },
];

function TimelineStep({
  step,
  index,
  isActive,
  isLast,
  onClick,
}: {
  step: (typeof iosSteps)[0];
  index: number;
  isActive: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  const Icon = step.icon;

  return (
    <div className="relative flex gap-4 cursor-pointer group" onClick={onClick}>
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <motion.div
          className={`relative z-10 flex items-center justify-center h-10 w-10 rounded-full border-2 shrink-0 transition-all duration-300 ${
            isActive
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground group-hover:border-primary/50"
          }`}
          animate={isActive ? { scale: [1, 1.08, 1] } : {}}
          transition={isActive ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
        >
          <span className="text-sm font-bold">{index + 1}</span>
          {isActive && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
            />
          )}
        </motion.div>
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[2rem] transition-colors duration-300 ${
            isActive ? "bg-primary/40" : "bg-border"
          }`} />
        )}
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        className={`flex-1 pb-6 rounded-xl transition-all duration-300 ${
          isActive ? "" : ""
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
          <h3 className={`text-sm font-bold transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
            {step.title}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

        <AnimatePresence>
          {isActive && step.tip && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-2.5">
                <span className="text-xs shrink-0">💡</span>
                <p className="text-[0.7rem] text-muted-foreground leading-relaxed">{step.tip}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default function Install() {
  const [selected, setSelected] = useState<Platform>(null);
  const detectedPlatform = detectPlatform();
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const benefitsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(mq.matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  const activePlatform = selected ?? detectedPlatform ?? "android";
  const steps = activePlatform === "ios" ? iosSteps : androidSteps;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-lg">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <img src={logo} alt="VitraPay" className="h-7 w-7 rounded-lg" />
          <span className="font-bold text-foreground text-sm">Instalar App</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-lg mx-auto w-full relative z-10">
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
              O VitraPay já está instalado no seu dispositivo.
            </p>
            <Link to="/dashboard">
              <Button className="mt-4">Ir para o Dashboard</Button>
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-3 mb-6"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
                className="relative mx-auto w-36"
              >
                {/* Glow behind phone */}
                <div className="absolute inset-0 bg-primary/15 blur-[60px] rounded-full scale-110" />
                <img
                  src={iphoneMockup}
                  alt="App VitraPay"
                  className="relative w-full drop-shadow-2xl"
                />
              </motion.div>

              <div>
                <h1 className="text-xl font-bold text-foreground mb-1">
                  Instale o VitraPay
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
                  Adicione à sua tela inicial em{" "}
                  <strong className="text-foreground">3 passos simples</strong>
                </p>
              </div>

              {/* Native install button */}
              {deferredPrompt && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Button
                    onClick={handleNativeInstall}
                    disabled={installing}
                    className="gap-2 rounded-xl h-12 px-6 text-sm font-bold shadow-lg shadow-primary/20"
                  >
                    <Download className="h-5 w-5" />
                    {installing ? "Instalando..." : "Instalar agora"}
                  </Button>
                </motion.div>
              )}
            </motion.div>

            {/* Platform selector */}
            <div className="flex gap-2 mb-1 w-full">
              <Button
                variant={activePlatform === "ios" ? "default" : "outline"}
                className="flex-1 gap-2 h-11 rounded-xl text-xs font-semibold"
                onClick={() => { setSelected("ios"); setActiveStep(0); }}
              >
                <Apple className="h-4 w-4" />
                iPhone / iPad
              </Button>
              <Button
                variant={activePlatform === "android" ? "default" : "outline"}
                className="flex-1 gap-2 h-11 rounded-xl text-xs font-semibold"
                onClick={() => { setSelected("android"); setActiveStep(0); }}
              >
                <Smartphone className="h-4 w-4" />
                Android
              </Button>
            </div>

            {/* Auto-detect */}
            {detectedPlatform && !selected && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[0.65rem] text-muted-foreground mb-3 flex items-center gap-1.5"
              >
                📱 Detectamos:{" "}
                <strong className="text-foreground">
                  {detectedPlatform === "ios" ? "iPhone / iPad" : "Android"}
                </strong>
              </motion.p>
            )}

            {/* Progress bar */}
            <div className="w-full flex gap-1.5 mb-5 mt-3">
              {steps.map((_, i) => (
                <motion.div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 cursor-pointer ${
                    i <= activeStep ? "bg-primary" : "bg-border"
                  }`}
                  onClick={() => setActiveStep(i)}
                  whileHover={{ scaleY: 2 }}
                />
              ))}
            </div>

            {/* Timeline Steps */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activePlatform}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="w-full"
              >
                {steps.map((step, i) => (
                  <TimelineStep
                    key={step.title}
                    step={step}
                    index={i}
                    isActive={activeStep === i}
                    isLast={i === steps.length - 1}
                    onClick={() => setActiveStep(i)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Benefits carousel */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 w-full"
            >
              <h3 className="text-[0.65rem] font-semibold text-muted-foreground uppercase tracking-widest text-center mb-3">
                Por que instalar?
              </h3>
              <div
                ref={benefitsRef}
                className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {benefits.map((b, i) => {
                  const Icon = b.icon;
                  return (
                    <motion.div
                      key={b.text}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.06 }}
                      className="flex-none w-[130px] snap-start flex flex-col items-center gap-2 p-3.5 rounded-2xl border border-border bg-card/50 text-center"
                    >
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center relative">
                        <div className="absolute inset-0 rounded-xl bg-primary/5 blur-sm" />
                        <Icon className="h-4 w-4 text-primary relative z-10" />
                      </div>
                      <span className="text-[0.65rem] font-bold text-foreground leading-tight">{b.text}</span>
                      <span className="text-[0.6rem] text-muted-foreground leading-tight">{b.desc}</span>
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
                transition={{ delay: 0.5 }}
                className="mt-4 flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/10 p-3 w-full"
              >
                <span className="text-xs shrink-0">ℹ️</span>
                <p className="text-[0.65rem] text-muted-foreground leading-relaxed">
                  No iPhone, notificações push funcionam a partir do <strong className="text-foreground">iOS 16.4</strong> com o app instalado.
                </p>
              </motion.div>
            )}

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6 mb-4 text-center"
            >
              <p className="text-[0.65rem] text-muted-foreground mb-2.5">Já instalou?</p>
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs">
                  Ir para o Dashboard
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
