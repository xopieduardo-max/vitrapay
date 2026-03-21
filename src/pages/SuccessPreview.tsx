import { motion } from "framer-motion";
import { CheckCircle2, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function SuccessPreview() {
  const mockData = {
    product_title: "Método Digital PRO",
    amount: 49700,
    sale_id: "pay_abc123def456",
    file_url: "#",
    product_type: "ebook",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 checkout-dark" style={{ background: "var(--ck-bg)", color: "var(--ck-fg)" }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-lg w-full rounded-3xl p-8 text-center space-y-6 relative overflow-hidden"
        style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}
      >
        {/* Confetti-like decorative dots */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 8 + 4,
                height: Math.random() * 8 + 4,
                background: `hsl(${48 + Math.random() * 20}, 96%, ${45 + Math.random() * 15}%)`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: 0.15 + Math.random() * 0.2,
              }}
              animate={{
                y: [0, -10, 0],
                opacity: [0.15, 0.35, 0.15],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        {/* Leonardo DiCaprio celebration GIF */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex justify-center relative z-10"
        >
          <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: "2px solid hsl(48,96%,53%,0.3)" }}>
            <img
              src="https://media.giphy.com/media/g9582DNuQppxC/giphy.gif"
              alt="Celebração"
              className="w-48 h-auto"
            />
          </div>
        </motion.div>

        {/* Success badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
          className="flex justify-center relative z-10"
        >
          <div
            className="h-14 w-14 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: "linear-gradient(135deg, hsl(48,96%,53%), hsl(38,92%,45%))",
              boxShadow: "0 0 30px hsl(48,96%,53%,0.4)",
            }}
          >
            <CheckCircle2 className="h-7 w-7 text-black" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2 relative z-10"
        >
          <h1 className="text-3xl font-black tracking-tight">
            Compra Confirmada! 🎉
          </h1>
          <p className="text-base" style={{ color: "var(--ck-muted)" }}>
            Parabéns! Seu acesso a <strong style={{ color: "hsl(48,96%,53%)" }}>{mockData.product_title}</strong> já está liberado.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl p-5 space-y-3 relative z-10"
          style={{ background: "var(--ck-bg)", border: "1px solid var(--ck-card-border)" }}
        >
          <div className="flex justify-between items-center text-sm">
            <span style={{ color: "var(--ck-subtle)" }}>Valor pago</span>
            <span className="font-bold text-lg" style={{ color: "hsl(48,96%,53%)" }}>
              R$ {(mockData.amount / 100).toFixed(2)}
            </span>
          </div>
          <Separator className="opacity-20" />
          <div className="flex justify-between items-center text-sm">
            <span style={{ color: "var(--ck-subtle)" }}>ID da venda</span>
            <span className="font-mono text-xs px-2 py-1 rounded-lg" style={{ background: "var(--ck-card)", color: "var(--ck-muted)" }}>
              {mockData.sale_id.slice(0, 12)}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="space-y-3 relative z-10"
        >
          <Button
            className="w-full h-14 text-base font-bold gap-3 rounded-2xl shadow-lg transition-all hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, hsl(48,96%,53%), hsl(38,92%,45%))",
              color: "hsl(0,0%,10%)",
              boxShadow: "0 4px 20px hsl(48,96%,53%,0.3)",
            }}
            onClick={() => {}}
          >
            <ArrowDownToLine className="h-5 w-5" /> Baixar Produto
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-xs relative z-10"
          style={{ color: "var(--ck-subtle)" }}
        >
          Um email de confirmação foi enviado para você 📧
        </motion.p>
      </motion.div>
    </div>
  );
}
