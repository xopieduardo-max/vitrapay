import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EMOJIS = ["🎉", "🚀", "💰", "⭐", "🔥", "✨", "🏆", "💎"];
const PARTICLE_COUNT = 24;

interface Props {
  revenue: number;
  milestones: number[];
}

export function MilestoneCelebration({ revenue, milestones }: Props) {
  const [celebrating, setCelebrating] = useState(false);
  const [reachedMilestone, setReachedMilestone] = useState(0);

  const checkMilestone = useCallback(() => {
    const celebrated = JSON.parse(localStorage.getItem("celebrated_milestones") || "[]") as number[];
    for (const m of milestones) {
      if (revenue >= m && !celebrated.includes(m)) {
        celebrated.push(m);
        localStorage.setItem("celebrated_milestones", JSON.stringify(celebrated));
        setReachedMilestone(m);
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), 4000);
        return;
      }
    }
  }, [revenue, milestones]);

  useEffect(() => {
    if (revenue > 0) checkMilestone();
  }, [revenue, checkMilestone]);

  const fmt = (v: number) =>
    `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (!celebrating) return null;

  return (
    <AnimatePresence>
      {celebrating && (
        <>
          {/* Confetti particles */}
          <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
            {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 0.8;
              const duration = 2.5 + Math.random() * 1.5;
              const emoji = EMOJIS[i % EMOJIS.length];
              const size = 16 + Math.random() * 16;
              const rotation = Math.random() * 720 - 360;

              return (
                <motion.div
                  key={i}
                  initial={{ y: -40, x: `${left}vw`, opacity: 1, rotate: 0, scale: 0 }}
                  animate={{
                    y: "110vh",
                    opacity: [1, 1, 0.8, 0],
                    rotate: rotation,
                    scale: [0, 1.2, 1, 0.8],
                  }}
                  transition={{ duration, delay, ease: "easeIn" }}
                  className="absolute"
                  style={{ fontSize: size, left: 0, top: 0 }}
                >
                  {emoji}
                </motion.div>
              );
            })}
          </div>

          {/* Center banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-[10000]"
          >
            <div className="bg-card border-2 border-primary/50 rounded-2xl px-8 py-6 shadow-2xl text-center max-w-sm">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-5xl mb-3"
              >
                🏆
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-xl font-bold text-foreground mb-1"
              >
                Meta atingida!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-2xl font-extrabold text-primary"
              >
                {fmt(reachedMilestone)}
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                className="text-sm text-muted-foreground mt-2"
              >
                Parabéns! Continue assim 🚀
              </motion.p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
