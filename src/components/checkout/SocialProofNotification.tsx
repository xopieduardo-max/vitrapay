import { useState, useEffect } from "react";
import logoIcon from "@/assets/logo-vitrapay-icon-square.png";

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
  interval: number;
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

      const useNameMessage = Math.random() > 0.5;
      if (useNameMessage) {
        setMessage(`${name} de ${city} acabou de comprar o ${productName}!`);
      } else {
        setMessage(template.replace("{count}", String(count)).replace("{product}", productName));
      }

      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    };

    const initialTimeout = setTimeout(showNotification, (interval * 1000) / 2);
    const timer = setInterval(showNotification, interval * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(timer);
    };
  }, [enabled, interval, productName]);

  if (!enabled || !visible) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-50 max-w-[320px]"
      style={{
        animation: "socialProofSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <style>{`
        @keyframes socialProofSlideIn {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl backdrop-blur-sm"
        style={{
          background: "var(--ck-card)",
          border: "1px solid var(--ck-card-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-background">
          <img src={logoIcon} alt="VitraPay" width={24} height={24} className="h-6 w-6 object-contain" />
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
    </div>
  );
}
