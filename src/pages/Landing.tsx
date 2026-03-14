import {
  Zap, ArrowRight, Package, Users, TrendingUp, Shield, CreditCard,
  BarChart3, Rocket, Clock, Headphones, Award, ChevronRight, Star,
  DollarSign, Wallet, Globe, Play, CheckCircle2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
};

const stagger = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const highlights = [
  { icon: Rocket, title: "Saque rápido", desc: "Receba seu dinheiro na conta em minutos" },
  { icon: TrendingUp, title: "Projetada para escala", desc: "Escale suas vendas com taxas imperdíveis" },
  { icon: Award, title: "Premiações", desc: "Premiações a cada marca de faturamento" },
  { icon: Shield, title: "Menos burocracia", desc: "Plataforma sem burocracia desnecessária" },
  { icon: Headphones, title: "Suporte 24/7", desc: "Suporte humano, disponível o tempo todo" },
  { icon: BarChart3, title: "Métricas em tempo real", desc: "Acompanhe suas métricas ao vivo" },
];

const features = [
  {
    icon: Package,
    title: "Produtos Digitais",
    desc: "Venda cursos, e-books, templates, mentorias e qualquer infoproduto com facilidade.",
  },
  {
    icon: Users,
    title: "Programa de Afiliados",
    desc: "Deixe outros promoverem seus produtos e defina comissões personalizadas.",
  },
  {
    icon: CreditCard,
    title: "Checkout de Alta Conversão",
    desc: "Checkout customizável com timer, banners, cupons e order bumps.",
  },
  {
    icon: Globe,
    title: "Área de Membros",
    desc: "Player de vídeo, módulos, aulas e acompanhamento de progresso dos alunos.",
  },
  {
    icon: Wallet,
    title: "Financeiro Completo",
    desc: "Saldo, comissões, histórico de saques e pagamento via Pix automático.",
  },
  {
    icon: BarChart3,
    title: "Funil de Vendas",
    desc: "Upsell, downsell e order bumps integrados ao seu checkout.",
  },
];

const paymentMethods = [
  { name: "Pix", time: "Instantâneo", icon: "⚡" },
  { name: "Cartão de Crédito", time: "Em até 2 dias", icon: "💳" },
  { name: "Boleto Bancário", time: "1 dia", icon: "📄" },
];

const stats = [
  { value: "10k+", label: "Produtores ativos" },
  { value: "R$ 50M+", label: "Em vendas processadas" },
  { value: "99.9%", label: "Uptime garantido" },
  { value: "24/7", label: "Suporte humanizado" },
];

const testimonials = [
  {
    name: "Lucas Andrade",
    role: "Infoprodutor",
    text: "Migrei pra Aether e minhas vendas cresceram 40% no primeiro mês. O checkout é muito mais rápido.",
    stars: 5,
  },
  {
    name: "Mariana Costa",
    role: "Produtora de Cursos",
    text: "A área de membros é incrível. Meus alunos adoraram a experiência e minha taxa de conclusão subiu muito.",
    stars: 5,
  },
  {
    name: "Rafael Souza",
    role: "Afiliado Top",
    text: "Ganho comissões de mais de 15 produtos. O painel financeiro é transparente e o saque cai rápido.",
    stars: 5,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary glow-primary">
              <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
            </div>
            <span className="text-xl font-bold tracking-title">Aether</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Recursos</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Taxas</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Depoimentos</a>
            <Link to="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/auth">Login</Link>
            </Button>
            <Button size="sm" asChild className="glow-primary">
              <Link to="/auth">Criar minha conta</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative">
        {/* Background glow effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />
        </div>

        <div className="container relative py-20 md:py-32 lg:py-40">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
            className="max-w-4xl mx-auto text-center space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>A plataforma que acelera seus resultados</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-display leading-[1.05]">
              Venda produtos digitais{" "}
              <span className="text-gradient-primary">sem limites.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Publique seus infoprodutos, gerencie afiliados, receba pagamentos via Pix instantâneo e escale seu negócio digital — tudo em uma única plataforma.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                size="lg"
                className="h-14 px-10 text-base font-semibold gap-2 glow-primary-strong hover:scale-[1.02] transition-all duration-200"
                asChild
              >
                <Link to="/auth">
                  Criar minha conta grátis <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-10 text-base gap-2 border-border/50"
                asChild
              >
                <Link to="/marketplace">
                  <Play className="h-4 w-4" /> Ver Marketplace
                </Link>
              </Button>
            </div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground"
            >
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-background bg-primary/20 flex items-center justify-center text-[0.6rem] font-bold text-primary"
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span>
                <strong className="text-foreground">+10.000</strong> produtores já confiam na Aether
              </span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Highlight Cards (Cakto-style bento) */}
      <section className="container pb-20">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, i) => (
            <motion.div
              key={item.title}
              {...stagger}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 md:p-6 space-y-3 hover:border-primary/30 hover:bg-card transition-all duration-300"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <item.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold tracking-title text-sm md:text-base">{item.title}</h3>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border/50 bg-card/30">
        <div className="container py-16">
          <div className="grid gap-8 grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                {...stagger}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="text-center space-y-2"
              >
                <p className="text-3xl md:text-5xl font-bold tracking-display text-gradient-primary">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-20 md:py-28">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
          <span className="text-xs font-medium uppercase tracking-label text-primary">Recursos</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-display">
            Tudo que você precisa para{" "}
            <span className="text-gradient-primary">vender online</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Uma plataforma completa com checkout customizável, área de membros, programa de afiliados e muito mais.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              {...stagger}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group relative rounded-2xl border border-border/50 bg-card/50 p-7 space-y-4 hover:border-primary/30 transition-all duration-300 overflow-hidden"
            >
              {/* Subtle glow on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-title">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Payment Methods (Cakto-style) */}
      <section id="pricing" className="bg-card/30 border-y border-border/50">
        <div className="container py-20 md:py-28">
          <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
            <span className="text-xs font-medium uppercase tracking-label text-primary">Pagamentos</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-display">
              Receba de{" "}
              <span className="text-gradient-primary">múltiplas formas</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">
              Aceite Pix, cartão de crédito e boleto. Receba rápido e com as melhores taxas do mercado.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3 max-w-3xl mx-auto">
            {paymentMethods.map((pm, i) => (
              <motion.div
                key={pm.name}
                {...stagger}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-2xl border border-border/50 bg-background p-6 text-center space-y-3 hover:border-primary/30 transition-all duration-300"
              >
                <span className="text-4xl">{pm.icon}</span>
                <h3 className="font-semibold tracking-title">{pm.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Prazo de recebimento:{" "}
                  <span className="text-primary font-medium">{pm.time}</span>
                </p>
              </motion.div>
            ))}
          </div>

          {/* Tax highlight */}
          <motion.div
            {...fadeUp}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-12 max-w-xl mx-auto text-center"
          >
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8">
              <p className="text-sm text-muted-foreground mb-2">Taxa para cartões na plataforma</p>
              <p className="text-4xl md:text-5xl font-bold tracking-display text-gradient-primary">
                3,89% + R$2,49
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                Pix com taxa <strong className="text-primary">0%</strong> para seus clientes
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="container py-20 md:py-28">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
          <span className="text-xs font-medium uppercase tracking-label text-primary">Depoimentos</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-display">
            Quem usa, <span className="text-gradient-primary">recomenda</span>
          </h2>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              {...stagger}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="rounded-2xl border border-border/50 bg-card/50 p-7 space-y-4"
            >
              <div className="flex gap-0.5">
                {[...Array(t.stars)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">"{t.text}"</p>
              <div className="flex items-center gap-3 pt-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container pb-20 md:pb-28">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl border border-primary/20 bg-primary/5 overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/10 blur-[100px]" />
          </div>

          <div className="relative px-8 py-16 md:py-24 text-center space-y-6">
            <h2 className="text-3xl md:text-5xl font-bold tracking-display">
              Comece a vender{" "}
              <span className="text-gradient-primary">agora mesmo</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-lg">
              Crie sua conta grátis em menos de 2 minutos e comece a faturar com seus produtos digitais.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                size="lg"
                className="h-14 px-12 text-base font-semibold gap-2 glow-primary-strong hover:scale-[1.02] transition-all duration-200"
                asChild
              >
                <Link to="/auth">
                  Criar minha conta grátis <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-4">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem taxa de adesão
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Pix instantâneo
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Suporte 24/7
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30">
        <div className="container py-12">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
                </div>
                <span className="text-lg font-bold tracking-title">Aether</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A plataforma de pagamentos que acelera seus resultados digitais.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-label text-muted-foreground/60">Produto</h4>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link to="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
                <a href="#features" className="hover:text-foreground transition-colors">Recursos</a>
                <a href="#pricing" className="hover:text-foreground transition-colors">Taxas</a>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-label text-muted-foreground/60">Empresa</h4>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <a href="#" className="hover:text-foreground transition-colors">Sobre</a>
                <a href="#" className="hover:text-foreground transition-colors">Blog</a>
                <a href="#" className="hover:text-foreground transition-colors">Contato</a>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-label text-muted-foreground/60">Legal</h4>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a>
                <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>© 2026 Aether. Todos os direitos reservados.</span>
            <span className="text-xs">Feito com precisão ⚡</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
