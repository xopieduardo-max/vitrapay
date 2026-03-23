import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoIcon from "@/assets/logo-vitrapay.png";

const MESSAGES = [
  "{count} pessoas estão comprando o {product} agora.",
  "{count} pessoas compraram o {product} agora mesmo.",
  "{count} pessoas compraram o {product} nos últimos 30 minutos.",
  "{count} pessoas compraram o {product} na última hora.",
];

const FIRST_NAMES = [
  "Maria", "João", "Ana", "Carlos", "Juliana", "Pedro", "Fernanda", "Lucas",
  "Camila", "Rafael", "Beatriz", "Gustavo", "Larissa", "Felipe", "Amanda",
  "Thiago", "Patrícia", "Bruno", "Aline", "Diego", "Isabela", "Marcos",
];

interface Props {
  enabled: boolean;
  interval: number; // seconds
  productName: string;
}

export function SocialProofNotification({ enabled, interval, productName }: Props) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled) return;

    const showNotification = () => {
      const template = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      const count = Math.floor(Math.random() * 15) + 3;
      const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const city = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Salvador", "Fortaleza"][Math.floor(Math.random() * 6)];
      
      // Alternate between count-based and name-based messages
      const useNameMessage = Math.random() > 0.5;
      if (useNameMessage) {
        setMessage(`${name} de ${city} acabou de comprar o ${productName}!`);
      } else {
        setMessage(template.replace("{count}", String(count)).replace("{product}", productName));
      }
      
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    };

    // First notification after a delay
    const initialTimeout = setTimeout(showNotification, (interval * 1000) / 2);
    const timer = setInterval(showNotification, interval * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(timer);
    };
  }, [enabled, interval, productName]);

  if (!enabled) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-4 left-4 z-50 max-w-[320px]"
        >
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl backdrop-blur-sm"
            style={{
              background: "var(--ck-card)",
              border: "1px solid var(--ck-card-border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          >
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "hsl(142, 71%, 45%, 0.15)" }}
            >
              <ShoppingCart className="h-4 w-4" style={{ color: "hsl(142, 71%, 45%)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-snug" style={{ color: "var(--ck-fg)" }}>
                {message}
              </p>
              <p className="text-[0.6rem] mt-0.5" style={{ color: "var(--ck-subtle)" }}>
                Agora mesmo • Verificado ✓
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
