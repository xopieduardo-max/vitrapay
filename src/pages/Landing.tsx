import { Zap, ArrowRight, Package, Users, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const features = [
  { icon: Package, title: "Produtos Digitais", desc: "Venda cursos, e-books, templates e mais." },
  { icon: Users, title: "Programa de Afiliados", desc: "Deixe outros promoverem seus produtos." },
  { icon: TrendingUp, title: "Analytics em Tempo Real", desc: "Acompanhe vendas, cliques e conversões." },
  { icon: Shield, title: "Checkout Seguro", desc: "Stripe e Mercado Pago integrados." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
            </div>
            <span className="text-lg font-bold tracking-title">Aether</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/marketplace">Marketplace</Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard">Entrar</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
          className="max-w-3xl mx-auto text-center space-y-6"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-display leading-[1.1]">
            Sua infraestrutura de vendas,{" "}
            <span className="text-gradient-primary">sem o atrito.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Publique produtos digitais, gerencie afiliados e receba pagamentos — tudo em uma plataforma.
          </p>
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button size="lg" className="h-12 px-8 text-base font-semibold gap-2 hover:glow-primary transition-shadow" asChild>
              <Link to="/dashboard">
                Começar Agora <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
              <Link to="/marketplace">Ver Marketplace</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="container pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="rounded-lg border border-border bg-card p-6 space-y-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold tracking-title">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <span>© 2026 Aether. Todos os direitos reservados.</span>
          <span className="text-xs">Feito com precisão.</span>
        </div>
      </footer>
    </div>
  );
}
