import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Package, BarChart3, Users, Settings, Rocket, X } from "lucide-react";

const STEPS = [
  {
    icon: Rocket,
    title: "Bem-vindo ao VitraPay! 🚀",
    description: "Sua plataforma completa para vender produtos digitais. Vamos te guiar pelos primeiros passos.",
    action: null,
  },
  {
    icon: Package,
    title: "Crie seu primeiro produto",
    description: "Cadastre um produto digital — ebook, curso, template — e defina preço, comissão de afiliados e mais.",
    action: "/products/new",
  },
  {
    icon: BarChart3,
    title: "Acompanhe suas vendas",
    description: "No painel de vendas você vê receitas em tempo real, taxa de conversão e ticket médio.",
    action: "/sales",
  },
  {
    icon: Users,
    title: "Programa de Afiliados",
    description: "Ative o programa de afiliados nos seus produtos e deixe outros promoverem para você.",
    action: "/marketplace",
  },
  {
    icon: Settings,
    title: "Personalize seu checkout",
    description: "Edite cada produto para configurar banner, timer de urgência, depoimentos e pixels de rastreamento.",
    action: null,
  },
];

const STORAGE_KEY = "vitrapay_onboarding_done";

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const goToAction = () => {
    const s = STEPS[step];
    if (s.action) {
      finish();
      navigate(s.action);
    }
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && finish()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
        >
          <button
            onClick={finish}
            className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
            </div>

            <div>
              <h3 className="text-lg font-bold">{current.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{current.description}</p>
            </div>

            {/* Step dots */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2 w-full">
              {current.action && (
                <Button variant="outline" className="flex-1" onClick={goToAction}>
                  Ir agora
                </Button>
              )}
              <Button className="flex-1" onClick={next}>
                {step < STEPS.length - 1 ? "Próximo" : "Começar!"}
              </Button>
            </div>

            <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Pular tutorial
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
