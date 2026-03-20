import { useState, useEffect } from "react";
import { Smartphone, Apple, MonitorSmartphone, Share, PlusSquare, MoreVertical, Download, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import appMockup from "@/assets/app-mockup.png";

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
    title: "Toque no botão Compartilhar",
    description: "Na barra inferior do Safari, toque no ícone de compartilhamento (quadrado com seta para cima).",
  },
  {
    icon: PlusSquare,
    title: "\"Adicionar à Tela de Início\"",
    description: "Role as opções e toque em \"Adicionar à Tela de Início\".",
  },
  {
    icon: CheckCircle2,
    title: "Confirme e pronto!",
    description: "Toque em \"Adicionar\". O app aparecerá na sua tela inicial como um ícone real.",
  },
];

const androidSteps = [
  {
    icon: MoreVertical,
    title: "Toque no menu do navegador",
    description: "No Chrome, toque nos 3 pontinhos no canto superior direito.",
  },
  {
    icon: Download,
    title: "\"Instalar aplicativo\" ou \"Adicionar à tela inicial\"",
    description: "Selecione a opção de instalação no menu que aparecer.",
  },
  {
    icon: CheckCircle2,
    title: "Confirme e pronto!",
    description: "Toque em \"Instalar\". O app será adicionado à sua tela inicial.",
  },
];

function StepCard({ step, index }: { step: typeof iosSteps[0]; index: number }) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
      className="flex gap-4 items-start p-4 rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[0.65rem] font-bold shrink-0">
            {index + 1}
          </span>
          <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
      </div>
    </motion.div>
  );
}

export default function Install() {
  const [selected, setSelected] = useState<Platform>(null);
  const detectedPlatform = detectPlatform();
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(mq.matches);
  }, []);

  const activePlatform = selected ?? detectedPlatform;
  const steps = activePlatform === "ios" ? iosSteps : androidSteps;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border">
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

      <main className="flex-1 flex flex-col items-center px-4 py-8 max-w-lg mx-auto w-full">
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
              O Aether já está instalado no seu dispositivo. Aproveite!
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
              className="text-center space-y-5 mb-8"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="relative mx-auto w-48 sm:w-56"
              >
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75" />
                <img
                  src={appMockup}
                  alt="App Aether no celular"
                  className="relative w-full drop-shadow-2xl"
                />
              </motion.div>
              <h1 className="text-2xl font-bold text-foreground">
                Instale o Aether
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Tenha acesso rápido ao seu painel, receba notificações de vendas em tempo real e use o app mesmo offline.
              </p>
            </motion.div>

            {/* Platform selector */}
            <div className="flex gap-2 mb-6 w-full">
              <Button
                variant={activePlatform === "ios" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setSelected("ios")}
              >
                <Apple className="h-4 w-4" />
                iPhone
              </Button>
              <Button
                variant={activePlatform === "android" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setSelected("android")}
              >
                <Smartphone className="h-4 w-4" />
                Android
              </Button>
            </div>

            {/* Auto-detect note */}
            {detectedPlatform && !selected && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[0.7rem] text-muted-foreground mb-4 text-center"
              >
                📱 Detectamos que você está usando {detectedPlatform === "ios" ? "iPhone" : "Android"}
              </motion.p>
            )}

            {/* Steps */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activePlatform}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full space-y-3"
              >
                {steps.map((step, i) => (
                  <StepCard key={step.title} step={step} index={i} />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 w-full rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Benefícios do App
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { emoji: "⚡", text: "Acesso rápido" },
                  { emoji: "🔔", text: "Notificações de vendas" },
                  { emoji: "📶", text: "Funciona offline" },
                  { emoji: "🚀", text: "Carregamento instantâneo" },
                ].map((b) => (
                  <div key={b.text} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-base">{b.emoji}</span>
                    {b.text}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* iOS push note */}
            {activePlatform === "ios" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-4 text-[0.7rem] text-muted-foreground text-center leading-relaxed"
              >
                💡 No iPhone, as notificações push funcionam a partir do <strong>iOS 16.4</strong> com o app instalado na tela inicial.
              </motion.p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
