import { useEffect, useRef, useState } from "react";
import {
  Zap, ArrowRight, Package, Users, TrendingUp, Shield, CreditCard,
  BarChart3, Rocket, Clock, Headphones, Award, Star,
  DollarSign, Wallet, Globe, Play, CheckCircle2, Sparkles, Smartphone,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import dashboardPreview from "@/assets/dashboard-preview.png";
import appMockup from "@/assets/app-mockup.png";
import logoHorizontal from "@/assets/logo-vitrapay-horizontal.png";
import logoImg from "@/assets/logo-vitrapay.png";
import { IPhoneFrame } from "@/components/IPhoneFrame";

/* ─── Floating Sale Notifications ─── */
const names = ["Lucas A.", "Maria S.", "João P.", "Ana L.", "Pedro R.", "Camila F.", "Rafael M.", "Juliana B.", "Thiago C.", "Fernanda D.", "Bruno K.", "Larissa T.", "Carlos H.", "Beatriz N.", "Diego V."];
const products = ["Copy que Vende", "Método Digital Pro", "IA Academy", "Social Media Mastery", "Renda Extra Online", "Corpo & Forma 360", "Funil Expert", "Tráfego Pago Pro"];
const amounts = [10, 14.90, 19.90, 27, 37, 39.90, 47, 57, 67, 79.90, 87, 97, 127, 147, 197, 247, 297, 347, 497];

function generateNotification() {
  return {
    name: names[Math.floor(Math.random() * names.length)],
    product: products[Math.floor(Math.random() * products.length)],
    amount: `R$ ${amounts[Math.floor(Math.random() * amounts.length)].toFixed(2).replace(".", ",")}`,
    method: (Math.random() > 0.4 ? "pix" : "card") as "pix" | "card",
  };
}

const methodConfig = {
  pix: {
    label: "Venda aprovada via Pix!",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-500",
    borderColor: "border-emerald-500/20",
    amountColor: "text-emerald-500",
  },
  card: {
    label: "Venda aprovada via Cartão!",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-500",
    borderColor: "border-blue-500/20",
    amountColor: "text-blue-500",
  },
};

function FloatingNotifications() {
  const [visibleNotifs, setVisibleNotifs] = useState<ReturnType<typeof generateNotification>[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleNotifs((prev) => {
        const next = [...prev, generateNotification()];
        return next.length > 4 ? next.slice(1) : next;
      });
    }, 3500);
    setVisibleNotifs([generateNotification()]);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-3 w-full">
      <AnimatePresence mode="popLayout">
        {visibleNotifs.map((notif, i) => {
          const config = methodConfig[notif.method];
          return (
            <motion.div
              key={`${notif.name}-${notif.amount}-${i}`}
              initial={{ opacity: 0, x: -60, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.9 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className={`flex items-center gap-3 rounded-xl border ${config.borderColor} bg-card/90 backdrop-blur-xl px-4 py-3 shadow-lg`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${config.iconBg} shrink-0`}>
                {notif.method === "pix" ? (
                  <DollarSign className={`h-4 w-4 ${config.iconColor}`} />
                ) : (
                  <CreditCard className={`h-4 w-4 ${config.iconColor}`} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {config.label}
                </p>
                <p className="text-[0.65rem] text-muted-foreground truncate">
                  {notif.name} • {notif.product}
                </p>
                <p className={`text-xs font-bold ${config.amountColor} mt-0.5`}>{notif.amount}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ─── Interactive Grid Background ─── */
function GridBackground() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { damping: 25, stiffness: 150 });
  const springY = useSpring(mouseY, { damping: 25, stiffness: 150 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Animated grid lines */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial glow that follows mouse */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
          background: "radial-gradient(circle, hsla(48, 96%, 53%, 0.08) 0%, transparent 70%)",
        }}
      />
      {/* Fixed ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />
    </div>
  );
}

/* ─── Floating Particles ─── */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Data ─── */
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
  { icon: Package, title: "Produtos Digitais", desc: "Venda cursos, e-books, templates, mentorias e qualquer infoproduto com facilidade." },
  { icon: Users, title: "Programa de Afiliados", desc: "Deixe outros promoverem seus produtos e defina comissões personalizadas." },
  { icon: CreditCard, title: "Checkout de Alta Conversão", desc: "Checkout customizável com timer, banners, cupons e order bumps." },
  { icon: Globe, title: "Área de Membros", desc: "Player de vídeo, módulos, aulas e acompanhamento de progresso dos alunos." },
  { icon: Wallet, title: "Financeiro Completo", desc: "Saldo, comissões, histórico de saques e pagamento via Pix automático." },
  { icon: BarChart3, title: "Funil de Vendas", desc: "Upsell, downsell e order bumps integrados ao seu checkout." },
];

const paymentMethods = [
  { name: "Pix", time: "Instantâneo", icon: "⚡" },
  { name: "Cartão de Crédito", time: "Em até 2 dias", icon: "💳" },
  { name: "Boleto Bancário", time: "1 dia", icon: "📄" },
];

const bigStats = [
  { value: "50+", label: "colaboradores engajados" },
  { value: "500K+", label: "usuários cadastrados" },
  { value: "10 mil+", label: "produtos cadastrados" },
];

const testimonials = [
  { name: "Lucas Andrade", role: "Infoprodutor", text: "Migrei pra VitraPay e minhas vendas cresceram 40% no primeiro mês. O checkout é muito mais rápido.", stars: 5 },
  { name: "Mariana Costa", role: "Produtora de Cursos", text: "A área de membros é incrível. Meus alunos adoraram a experiência e minha taxa de conclusão subiu muito.", stars: 5 },
  { name: "Rafael Souza", role: "Afiliado Top", text: "Ganho comissões de mais de 15 produtos. O painel financeiro é transparente e o saque cai rápido.", stars: 5 },
];

const marqueeText = "Transformando vidas através do digital";

/* ─── Counter Animation ─── */
function AnimatedCounter({ value, suffix = "" }: { value: string; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ type: "spring", damping: 15, stiffness: 200 }}
      className="text-5xl md:text-6xl font-bold text-gradient-primary inline-block"
    >
      {value}{suffix}
    </motion.span>
  );
}

/* ─── Main Landing ─── */
export default function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const dashboardY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const dashboardScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoHorizontal} alt="VitraPay" className="h-8 object-contain" />
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

      {/* Hero Section with interactive background */}
      <section ref={heroRef} className="relative min-h-[90vh] flex flex-col justify-center">
        <GridBackground />
        <FloatingParticles />

        <div className="container relative py-16 md:py-24 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
            className="max-w-4xl mx-auto text-center space-y-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>A plataforma que acelera seus resultados</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
              Venda produtos digitais{" "}
              <span className="text-gradient-primary">sem limites.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Publique seus infoprodutos, gerencie afiliados, receba pagamentos via Pix instantâneo e escale seu negócio digital.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" className="h-14 px-10 text-base font-semibold gap-2 glow-primary-strong hover:scale-[1.02] transition-all duration-200" asChild>
                <Link to="/auth">
                  Criar minha conta grátis <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-10 text-base gap-2 border-border/50" asChild>
                <Link to="/marketplace">
                  <Play className="h-4 w-4" /> Ver Marketplace
                </Link>
              </Button>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground"
            >
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-primary/20 flex items-center justify-center text-[0.6rem] font-bold text-primary">
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span><strong className="text-foreground">+10.000</strong> produtores já confiam na VitraPay</span>
            </motion.div>
          </motion.div>

          {/* Dashboard Preview + Floating Notifications */}
          <div className="mt-16 md:mt-20 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
            {/* Notifications column */}
            <div className="order-2 lg:order-1 max-h-[500px] overflow-hidden">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <Bell className="h-3 w-3 text-primary" />
                Notificações em tempo real
              </p>
              <FloatingNotifications />
            </div>
            {/* Dashboard screenshot */}
            <motion.div
              style={{ y: dashboardY, scale: dashboardScale }}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 1, ease: [0.2, 0, 0, 1] }}
              className="order-1 lg:order-2 relative rounded-2xl border border-border/50 overflow-hidden shadow-2xl shadow-primary/5 group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <img
                src={dashboardPreview}
                alt="Dashboard VitraPay com métricas de vendas em tempo real"
                className="w-full"
              />
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Highlight Cards with hover tilt effect */}
      <section className="container pb-20">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, i) => (
            <motion.div
              key={item.title}
              {...stagger}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="group rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 md:p-6 space-y-3 hover:border-primary/30 hover:bg-card transition-all duration-300 cursor-default"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                <item.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-sm md:text-base">{item.title}</h3>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Marquee */}
      <section className="relative border-y border-border/50 bg-primary/5 py-5 overflow-hidden">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(12)].map((_, i) => (
            <span key={i} className="mx-8 text-lg md:text-xl font-bold text-primary/80 flex items-center gap-3">
              <Zap className="h-4 w-4" /> {marqueeText}
            </span>
          ))}
        </div>
      </section>

      {/* Big Stats with animated counters */}
      <section className="bg-card/30">
        <div className="container py-20">
          <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center mb-16">
            <span className="text-xs font-medium uppercase tracking-widest text-primary">Sobre nós</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-4">
              Somos muito mais que uma{" "}
              <span className="text-gradient-primary">plataforma</span>
            </h2>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {bigStats.map((stat, i) => (
              <motion.div
                key={stat.label}
                {...stagger}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                whileHover={{ scale: 1.05 }}
                className="text-center rounded-2xl border border-border/50 bg-background p-8 space-y-2 hover:border-primary/30 transition-all duration-300"
              >
                <AnimatedCounter value={stat.value} />
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section with staggered reveal */}
      <section id="features" className="container py-20 md:py-28">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
          <span className="text-xs font-medium uppercase tracking-widest text-primary">Recursos</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
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
              whileHover={{ y: -8, scale: 1.01 }}
              className="group relative rounded-2xl border border-border/50 bg-card/50 p-7 space-y-4 hover:border-primary/30 transition-all duration-300 overflow-hidden cursor-default"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              {/* Glow dot */}
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                  <f.icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Payment Methods */}
      <section id="pricing" className="bg-card/30 border-y border-border/50">
        <div className="container py-20 md:py-28">
          <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
            <span className="text-xs font-medium uppercase tracking-widest text-primary">Pagamentos</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
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
                whileHover={{ y: -5, scale: 1.03 }}
                className="rounded-2xl border border-border/50 bg-background p-6 text-center space-y-3 hover:border-primary/30 transition-all duration-300"
              >
                <span className="text-4xl">{pm.icon}</span>
                <h3 className="font-semibold">{pm.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Prazo de recebimento:{" "}
                  <span className="text-primary font-medium">{pm.time}</span>
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp} transition={{ delay: 0.3, duration: 0.6 }} className="mt-12 max-w-xl mx-auto text-center">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 shimmer-gold">
              <p className="text-sm text-muted-foreground mb-2">Taxa para cartões na plataforma</p>
              <p className="text-4xl md:text-5xl font-bold tracking-tight text-gradient-primary">
                3,89% + R$2,49
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                Pix com taxa <strong className="text-primary">0%</strong> para seus clientes
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* App Coming Soon */}
      <section className="relative overflow-hidden">
        <FloatingParticles />
        <div className="container relative py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
                <Smartphone className="h-3.5 w-3.5" /> Novidade
              </span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
                Em breve o app da{" "}
                <span className="text-gradient-primary">VitraPay!</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Com o app da VitraPay você terá tudo o que precisa para gerenciar suas vendas na palma da sua mão. Acompanhe métricas, receba notificações de vendas e saque seus ganhos de qualquer lugar.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button variant="outline" className="h-12 px-6 gap-2 border-border/50" disabled>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  App Store — Em breve
                </Button>
                <Button variant="outline" className="h-12 px-6 gap-2 border-border/50" disabled>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 1.33a1.004 1.004 0 010 1.724l-2.302 1.33-2.498-2.498 2.498-2.886zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z"/></svg>
                  Google Play — Em breve
                </Button>
              </div>
            </motion.div>
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.2, duration: 0.6 }}
              whileHover={{ rotate: 2, scale: 1.02 }}
              className="flex justify-center"
            >
              <IPhoneFrame className="w-[240px] md:w-[280px]">
                <img
                  src={appMockup}
                  alt="App VitraPay"
                  className="w-full"
                />
              </IPhoneFrame>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="container py-20 md:py-28">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
          <span className="text-xs font-medium uppercase tracking-widest text-primary">Depoimentos</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Quem usa, <span className="text-gradient-primary">recomenda</span>
          </h2>
        </motion.div>
        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              {...stagger}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -5 }}
              className="rounded-2xl border border-border/50 bg-card/50 p-7 space-y-4 hover:border-primary/20 transition-all duration-300"
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
        <motion.div {...fadeUp} transition={{ duration: 0.6 }}
          className="relative rounded-3xl border border-primary/20 bg-primary/5 overflow-hidden"
        >
          <FloatingParticles />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/10 blur-[100px]" />
          </div>
          <div className="relative px-8 py-16 md:py-24 text-center space-y-6">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Comece a vender{" "}
              <span className="text-gradient-primary">agora mesmo</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-lg">
              Crie sua conta grátis em menos de 2 minutos e comece a faturar com seus produtos digitais.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" className="h-14 px-12 text-base font-semibold gap-2 glow-primary-strong hover:scale-[1.02] transition-all duration-200" asChild>
                <Link to="/auth">
                  Criar minha conta grátis <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground pt-4">
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
                <img src={logoImg} alt="VitraPay" className="h-9 w-9 rounded-lg object-contain" />
                <span className="text-lg font-bold tracking-tight">VitraPay</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A plataforma de pagamentos que acelera seus resultados digitais.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Produto</h4>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link to="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
                <a href="#features" className="hover:text-foreground transition-colors">Recursos</a>
                <a href="#pricing" className="hover:text-foreground transition-colors">Taxas</a>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Empresa</h4>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link to="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Legal</h4>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link to="/terms" className="hover:text-foreground transition-colors">Termos de Uso</Link>
                <Link to="/privacy" className="hover:text-foreground transition-colors">Política de Privacidade</Link>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>© 2026 VitraPay. Todos os direitos reservados.</span>
            <span className="text-xs">Feito com precisão ⚡</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
