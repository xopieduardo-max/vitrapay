import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, ArrowRight, Package, Users, TrendingUp, Shield, CreditCard,
  BarChart3, Rocket, Clock, Headphones, Award, Star,
  DollarSign, Wallet, Globe, Play, CheckCircle2, Sparkles, Smartphone,
  Bell, ChevronDown, MessageCircle, X } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import dashboardPreview from "@/assets/dashboard-preview.png";
import integrationsOrbit from "@/assets/integrations-orbit.png";
import appMockup from "@/assets/app-mockup.png";
import iphoneMockup3d from "@/assets/iphone-mockup-3d.png";
import iphone3dMockup from "@/assets/iphone-3d-mockup.png";
import membroBlack1 from "@/assets/membro-black-1.png";
import membroBlack2 from "@/assets/membro-black-2.png";
import placasVitraPay from "@/assets/placas-vitrapay.png";
import { ThemeLogo } from "@/components/ThemeLogo";
import { Interactive3DLogo } from "@/components/Interactive3DLogo";
import logoIcon from "@/assets/logo-vitrapay-icon-square.png";
import logoCard from "@/assets/logo-vitrapay-card.png";
import celularVitra from "@/assets/celular_vitra.png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger } from
"@/components/ui/accordion";
import { FeeSimulatorCard } from "@/components/FeeSimulatorCard";

/* ─── Floating Sale Notifications ─── */
const names = ["Lucas A.", "Maria S.", "João P.", "Ana L.", "Pedro R.", "Camila F.", "Rafael M.", "Juliana B.", "Thiago C.", "Fernanda D.", "Bruno K.", "Larissa T.", "Carlos H.", "Beatriz N.", "Diego V."];
const products = ["Copy que Vende", "Método Digital Pro", "IA Academy", "Social Media Mastery", "Renda Extra Online", "Corpo & Forma 360", "Funil Expert", "Tráfego Pago Pro"];
const amounts = [10, 14.90, 19.90, 27, 37, 39.90, 47, 57, 67, 79.90, 87, 97, 127, 147, 197, 247, 297, 347, 497];

type PayMethod = "pix" | "card" | "boleto";

function generateNotification() {
  const rand = Math.random();
  const method: PayMethod = rand > 0.6 ? "pix" : rand > 0.25 ? "card" : "boleto";
  return {
    name: names[Math.floor(Math.random() * names.length)],
    product: products[Math.floor(Math.random() * products.length)],
    amount: `R$ ${amounts[Math.floor(Math.random() * amounts.length)].toFixed(2).replace(".", ",")}`,
    method
  };
}

const methodLabels: Record<PayMethod, string> = {
  pix: "Pix",
  card: "Cartão",
  boleto: "Boleto"
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
        {visibleNotifs.map((notif, i) =>
        <motion.div
          key={`${notif.name}-${notif.amount}-${i}`}
          initial={{ opacity: 0, x: -60, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -40, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl px-4 py-3.5 shadow-lg">
          
            <div className="h-10 w-10 rounded-xl shrink-0 overflow-hidden bg-black">
              <img src={logoIcon} alt="" className="h-full w-full object-cover rounded-xl" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-foreground">Venda Aprovada! 🎉</p>
              </div>
              <p className="text-xs text-muted-foreground">VitraPay</p>
              <p className="text-xs text-muted-foreground">
                Pagamento via {methodLabels[notif.method]}
              </p>
              <p className="text-xs text-muted-foreground">
                Valor: <span className="font-semibold text-foreground">{notif.amount}</span>
              </p>
            </div>
            <span className="text-[0.6rem] text-muted-foreground/60 shrink-0 ml-auto pt-0.5">agora</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>);

}

/* ─── Interactive Grid Background ─── */
const GridBackground = React.memo(function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `
            linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
          `,
        backgroundSize: "60px 60px"
      }} />
      
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />
    </div>);

});

/* ─── Floating Particles (CSS-only) ─── */
const FloatingParticles = React.memo(function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) =>
      <div
        key={i}
        className="absolute w-1 h-1 rounded-full bg-primary/20 animate-float-particle"
        style={{
          left: `${15 + i * 15}%`,
          top: `${10 + i * 12}%`,
          animationDuration: `${5 + i}s`,
          animationDelay: `${i * 0.5}s`,
        }} />
      )}
    </div>);
});

/* ─── Membros Black Carousel (marquee rows) ─── */
const membrosBlack = [
  { name: "Pobre ADS", image: membroBlack1 },
  { name: "Eu Padre", image: membroBlack2 },
];

// Duplicate items to fill rows
const row1 = [...membrosBlack, ...membrosBlack, ...membrosBlack, ...membrosBlack];
const row2 = [...membrosBlack.reverse(), ...membrosBlack, ...membrosBlack, ...membrosBlack];

function MembrosBlackCarousel() {
  return (
    <div className="space-y-4 overflow-hidden -mx-4 md:-mx-8">
      {/* Row 1 – scrolls left (CSS marquee) */}
      <div className="flex gap-4 animate-marquee will-change-transform">
        {row1.map((m, i) => (
          <div
            key={`r1-${i}`}
            className="shrink-0 w-[200px] md:w-[240px] rounded-2xl border border-border/50 overflow-hidden shadow-lg shadow-primary/5 hover:border-primary/30 transition-colors duration-300"
          >
            <img
              src={m.image}
              alt={`Membro Black — ${m.name}`}
              className="w-full aspect-[4/5] object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="p-3 bg-card text-center">
              <p className="text-sm font-semibold truncate">{m.name}</p>
              <p className="text-[11px] text-primary font-medium">Membro Black ⚡</p>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2 – scrolls right (CSS marquee-reverse) */}
      <div className="flex gap-4 animate-marquee-reverse will-change-transform">
        {row2.map((m, i) => (
          <div
            key={`r2-${i}`}
            className="shrink-0 w-[200px] md:w-[240px] rounded-2xl border border-border/50 overflow-hidden shadow-lg shadow-primary/5 hover:border-primary/30 transition-colors duration-300"
          >
            <img
              src={m.image}
              alt={`Membro Black — ${m.name}`}
              className="w-full aspect-[4/5] object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="p-3 bg-card text-center">
              <p className="text-sm font-semibold truncate">{m.name}</p>
              <p className="text-[11px] text-primary font-medium">Membro Black ⚡</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Floating WhatsApp Button ─── */
function FloatingWhatsApp() {
  const [showPopup, setShowPopup] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dismissed) setShowPopup(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {showPopup && !dismissed &&
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          className="relative bg-card border border-border/50 rounded-2xl p-4 shadow-xl max-w-[260px]">
          
            <button
            onClick={() => {setDismissed(true);setShowPopup(false);}}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="text-sm font-medium text-foreground">Oi! 👋</p>
            <p className="text-xs text-muted-foreground mt-1">Está com dúvidas? Fale com nosso time agora.</p>
            <a
            href="https://wa.me/5543984668997"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            
              Iniciar conversa <ArrowRight className="h-3 w-3" />
            </a>
          </motion.div>
        }
      </AnimatePresence>
      <motion.a
        href="https://wa.me/5543984668997"
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {setDismissed(true);setShowPopup(false);}}
        className="flex items-center justify-center h-14 w-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 hover:shadow-[#25D366]/50 transition-shadow">
        
        <MessageCircle className="h-6 w-6" />
      </motion.a>
    </div>);

}

/* ─── Data ─── */
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" }
};

const stagger = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true }
};

const highlights = [
{ icon: Rocket, title: "Saque rápido", desc: "Receba seu dinheiro na conta em minutos" },
{ icon: TrendingUp, title: "Projetada para escala", desc: "Escale suas vendas com taxas imperdíveis" },
{ icon: Award, title: "Premiações", desc: "Premiações a cada marca de faturamento" },
{ icon: Shield, title: "Menos burocracia", desc: "Plataforma sem burocracia desnecessária" },
{ icon: Headphones, title: "Suporte 24/7", desc: "Suporte humano, disponível o tempo todo" },
{ icon: BarChart3, title: "Métricas em tempo real", desc: "Acompanhe suas métricas ao vivo" }];


/* Bento Grid Features */
const bentoFeatures = [
{
  icon: CreditCard,
  title: "Checkout de Alta Conversão",
  desc: "Checkout customizável com timer, banners, cupons, order bumps e upsell. Otimizado para converter.",
  size: "large" as const
},
{
  icon: Globe,
  title: "Área de Membros",
  desc: "Player de vídeo, módulos, aulas e acompanhamento de progresso dos alunos.",
  size: "small" as const
},
{
  icon: Users,
  title: "Programa de Afiliados",
  desc: "Deixe outros promoverem seus produtos e defina comissões personalizadas.",
  size: "small" as const
},
{
  icon: Wallet,
  title: "Financeiro Completo",
  desc: "Saldo disponível e pendente, comissões, histórico de saques e pagamento via Pix automático.",
  size: "small" as const
},
{
  icon: BarChart3,
  title: "Funil de Vendas",
  desc: "Upsell, downsell e order bumps integrados ao checkout para maximizar o ticket médio.",
  size: "small" as const
},
{
  icon: Package,
  title: "Produtos Digitais",
  desc: "Venda cursos, e-books, templates, mentorias e qualquer infoproduto com facilidade.",
  size: "large" as const
}];


const bigStats = [
{ value: "0%", label: "taxa no Pix para compradores" },
{ value: "D+0", label: "recebimento instantâneo via Pix" },
{ value: "24/7", label: "suporte humano disponível" }];


const testimonials = [
{ name: "Lucas Andrade", role: "Infoprodutor", handle: "@lucas.andrade", text: "Migrei pra VitraPay e minhas vendas cresceram 40% no primeiro mês. O checkout é muito mais rápido.", stars: 5 },
{ name: "Mariana Costa", role: "Produtora de Cursos", handle: "@mari.costa", text: "A área de membros é incrível. Meus alunos adoraram a experiência e minha taxa de conclusão subiu muito.", stars: 5 },
{ name: "Rafael Souza", role: "Afiliado Top", handle: "@rafa.souza", text: "Ganho comissões de mais de 15 produtos. O painel financeiro é transparente e o saque cai rápido.", stars: 5 }];


const faqItems = [
{ q: "O que é a VitraPay?", a: "A VitraPay é uma plataforma completa de vendas de produtos digitais. Você pode vender cursos, e-books, mentorias e muito mais com checkout otimizado, área de membros, programa de afiliados e financeiro integrado." },
{ q: "Quais as taxas cobradas pela VitraPay?", a: "Para Pix, a taxa é zero para o comprador e o recebimento é instantâneo (D+0). Para cartão de crédito, a taxa inicial é de 3,99% + R$ 2,49 com recebimento em D+30, ou 4,99% + R$ 2,49 com antecipação D+2." },
{ q: "Como funciona o saque?", a: "Você pode solicitar saque a partir de R$ 10,00. O valor é enviado direto para sua chave Pix cadastrada. Saques são processados rapidamente pela nossa equipe." },
{ q: "Posso ter afiliados vendendo meus produtos?", a: "Sim! A VitraPay tem um programa de afiliados completo. Você define a comissão de cada produto e os afiliados recebem um link exclusivo para divulgar." },
{ q: "A plataforma tem área de membros?", a: "Sim! Você pode organizar conteúdo em módulos e aulas, adicionar vídeos, acompanhar o progresso dos alunos e oferecer uma experiência profissional de aprendizado." },
{ q: "Preciso pagar para criar minha conta?", a: "Não! A criação de conta é 100% gratuita. Você só paga taxas sobre as vendas realizadas. Sem mensalidade, sem taxa de adesão." },
];


const marqueeStats = [
{ icon: Globe, text: "Aceito em todo o Brasil" },
{ icon: Users, text: "Centenas de novos usuários todos os dias" },
{ icon: Rocket, text: "Saque instantâneo via Pix" },
{ icon: Shield, text: "Pagamentos 100% seguros" },
{ icon: CreditCard, text: "Pix e Cartão de Crédito" },
{ icon: BarChart3, text: "Métricas em tempo real" },
{ icon: Award, text: "Premiações por faturamento" },
{ icon: Headphones, text: "Suporte humano 24/7" },
{ icon: Smartphone, text: "App otimizado para mobile" }];


const marqueeText = "Transformando vidas através do digital";

/* ─── Counter Animation ─── */
function AnimatedCounter({ value }: {value: string;}) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ type: "spring", damping: 15, stiffness: 200 }}
      className="text-5xl md:text-6xl font-bold text-gradient-primary inline-block">
      
      {value}
    </motion.span>);

}

/* ─── Country Selector ─── */
function CountrySelector() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-muted/50 transition-colors text-sm">
        
        <span className="text-lg leading-none">🇧🇷</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open &&
        <motion.div
          initial={{ opacity: 0, y: -5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -5, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-card shadow-xl p-3 space-y-2 z-50">
          
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-primary/10">
              <span className="text-lg">🇧🇷</span>
              <span className="text-sm font-medium text-foreground">Brasil</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />
            </div>
            <div className="border-t border-border/50" />
            <p className="text-xs text-muted-foreground text-center py-1">
              🌎 Em breve, novos países
            </p>
          </motion.div>
        }
      </AnimatePresence>
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>);

}

/* ─── Main Landing ─── */
export default function Landing() {
  const heroRef = useRef<HTMLElement>(null);

  const { data: platformFees } = useQuery({
    queryKey: ["platform-fees-landing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_fees").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10
  });

  const feeDisplay = useMemo(() => {
    if (!platformFees) return { cardText: "...", pixText: "0%" };
    const pct = Number(platformFees.card_percentage);
    const fixed = (platformFees.card_fixed / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const pixFixed = platformFees.pix_fixed > 0 ?
    `R$${(platformFees.pix_fixed / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` :
    null;
    const pixPct = Number(platformFees.pix_percentage);
    const pixLabel = pixPct > 0 ? `${pixPct.toLocaleString("pt-BR")}%` : pixFixed ? pixFixed : "0%";
    return {
      cardText: `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% + R$${fixed}`,
      pixText: pixPct === 0 && !pixFixed ? "0%" : pixLabel,
      pixIsFree: pixPct === 0 && platformFees.pix_fixed === 0
    };
  }, [platformFees]);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const dashboardY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const dashboardScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);
  const dashboardRotateX = useTransform(scrollYProgress, [0, 0.6], [12, 0]);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Announcement Bar — desativado por enquanto */}

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 py-3 px-2 sm:px-4">
        <div className="container max-w-6xl mx-auto">
          <nav className="flex items-center justify-between rounded-full border border-border/40 bg-card/90 backdrop-blur-xl px-3 sm:px-5 py-2 sm:py-2.5 shadow-lg shadow-black/5 gap-2">
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <Link to="/" className="flex items-center gap-2 shrink-0">
                <ThemeLogo variant="horizontal" className="h-6 sm:h-7 object-contain" />
              </Link>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <CountrySelector />
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex font-semibold tracking-wide text-xs uppercase gap-2">
                <Link to="/auth">
                  Fazer login
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button size="sm" asChild className="font-semibold tracking-wide text-[10px] sm:text-xs uppercase rounded-full px-3 sm:px-5 gap-2">
                <Link to="/auth">
                  <span className="hidden sm:inline">Criar conta</span><span className="sm:hidden">Começar</span>
                  <div className="h-5 w-5 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section ref={heroRef} className="relative min-h-[90vh] flex flex-col justify-center">
        <GridBackground />
        <FloatingParticles />
        {/* Fade lateral (sombra nos cantos) */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 md:w-40 z-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 md:w-40 z-10 bg-gradient-to-l from-background to-transparent" />

        <div className="container relative py-8 md:py-14 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
            className="max-w-4xl mx-auto text-center space-y-6">


            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotateY: -45 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{ delay: 0.2, duration: 0.8, type: "spring", damping: 15 }}
              className="flex justify-center">
              
              <Interactive3DLogo className="w-[318px] h-[149px] md:w-[444px] md:h-[209px] cursor-grab active:cursor-grabbing" />
            </motion.div>

            <h1 className="relative text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              <span className="relative z-10 bg-gradient-to-b from-foreground via-foreground to-foreground/40 bg-clip-text text-transparent">
                A VitraPay enxerga o caminho
                <br />
                para não te deixar no escuro
              </span>
              {/* Glow central sutil */}
              <span className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,hsl(var(--primary)/0.06),transparent_70%)] blur-2xl pointer-events-none" />
            </h1>

            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Desenvolvida para negócios que não podem parar, nossa tecnologia combina automação inteligente, checkout otimizado e performance contínua para maximizar conversões com total segurança.
            </p>

            {/* ─── Dual CTAs ─── */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" className="relative h-14 px-10 text-base font-semibold gap-3 rounded-full border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary/20" asChild>
                <Link to="/auth" className="text-sm">
                  Criar minha conta
                  <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-10 text-base font-semibold gap-3 rounded-full border-2 border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200" asChild>
                <Link to="/auth">
                  Fazer login
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Dashboard Preview with notifications side by side */}
          <motion.div
            style={{ y: dashboardY, scale: dashboardScale, willChange: "transform" }}
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1, ease: [0.2, 0, 0, 1] }}
            className="mt-16 md:mt-24 max-w-[90rem] mx-auto relative flex items-start justify-center gap-6 px-4">
            
            {/* Floating Notifications — left side, desktop only */}
            <div className="hidden lg:block w-[280px] shrink-0 pt-8">
              <FloatingNotifications />
            </div>

            {/* Dashboard image with scroll-driven tilt */}
            <div className="flex-1 min-w-0" style={{ perspective: "1200px" }}>
              <motion.div
                style={{ rotateX: dashboardRotateX, willChange: "transform" }}
                className="relative rounded-2xl border border-border/30 overflow-hidden shadow-2xl shadow-primary/10 group origin-bottom">
                
                <img
                  src={dashboardPreview}
                  alt="Dashboard VitraPay com métricas de vendas em tempo real"
                  className="w-full"
                  loading="eager"
                  decoding="async" />
                
                {/* Fade overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/60 to-transparent" />
              </motion.div>
              {/* Glow effect beneath */}
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-primary/10 blur-[60px] rounded-full" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Highlight Cards — Dark Premium ─── */}
      <section className="relative bg-[#080808] border-y border-white/[0.06]">
        <div className="container py-20">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {highlights.map((item, i) =>
            <motion.div
              key={item.title}
              {...stagger}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 md:p-7 space-y-4 hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 cursor-default overflow-hidden">
              
                {/* Yellow top bar */}
                <div className="absolute top-0 left-6 right-6 h-[2px]">
                  <div className="w-16 h-full bg-primary rounded-b-full" />
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary group-hover:scale-110 transition-all duration-300">
                  <item.icon className="h-6 w-6 text-primary-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-sm md:text-base text-white">{item.title}</h3>
                <p className="text-xs md:text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Marquee ─── */}
      <section className="relative border-y border-border/50 bg-card/30 py-6 overflow-hidden space-y-4">
        {/* Fade lateral (sombra nos cantos) */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 md:w-48 z-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 md:w-48 z-10 bg-gradient-to-l from-background to-transparent" />
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(3)].map((_, rep) =>
          marqueeStats.map((item, i) =>
          <span key={`${rep}-${i}`} className="mx-3 inline-flex items-center gap-2.5 rounded-full border border-border/50 bg-muted/40 px-5 py-2.5 text-sm font-medium text-muted-foreground">
                <item.icon className="h-4 w-4 text-primary/70" />
                {item.text}
                <Sparkles className="h-3 w-3 text-primary/50 ml-1" />
              </span>
          )
          )}
        </div>
        <div className="flex whitespace-nowrap animate-marquee-reverse">
          {[...Array(12)].map((_, i) =>
          <span key={i} className="mx-6 text-sm md:text-base font-medium tracking-wide text-white/30 flex items-center gap-6 uppercase">
              VitraPay <span className="text-white/15 text-xs">✦</span> Vendas <span className="text-white/15 text-xs">✦</span> Resultados <span className="text-white/15 text-xs">✦</span> Digital <span className="text-white/15 text-xs">✦</span> Lucros <span className="text-white/15 text-xs">✦</span>
            </span>
          )}
        </div>
      </section>

      {/* ─── Big Stats ─── */}
      <section className="bg-card/30">
        <div className="container py-20">
          <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center mb-16">
            <span className="inline-flex items-center gap-0 text-xs font-medium uppercase tracking-widest text-primary"><span className="w-1 h-5 rounded-full bg-primary mr-3" />Sobre nós</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mt-4">
              Somos muito mais que uma{" "}
              <span className="text-gradient-primary">plataforma</span>
            </h2>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {bigStats.map((stat, i) =>
            <motion.div
              key={stat.label}
              {...stagger}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              className="text-center rounded-2xl border border-border/50 bg-background p-8 space-y-2 hover:border-primary/30 transition-all duration-300">
              
                <AnimatedCounter value={stat.value} />
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Features — Bento Grid ─── */}
      <section id="features" className="relative bg-[#080808] py-20 md:py-28 border-y border-white/[0.06]">
        <div className="container">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
          <span className="inline-flex items-center gap-0 text-xs font-medium uppercase tracking-widest text-primary"><span className="w-1 h-5 rounded-full bg-primary mr-3" />Recursos</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Tudo que você precisa para{" "}
            <span className="text-gradient-primary">vender online</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Uma plataforma completa com checkout customizável, área de membros, programa de afiliados e muito mais.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-[minmax(180px,auto)]">
          {bentoFeatures.map((f, i) =>
           <motion.div
            key={f.title}
            {...stagger}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className={`group relative rounded-2xl border border-border/50 bg-[#0a0a0a] p-7 flex flex-col justify-between hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-default ${
            f.size === "large" ? "lg:col-span-2 lg:row-span-1" : ""}`
            }>
            
              {/* Yellow top bar */}
              <div className="absolute top-0 left-7 w-16 h-[2px] bg-primary rounded-b-full" />

              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary group-hover:scale-110 transition-all duration-300">
                  <f.icon className="h-6 w-6 text-primary-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed max-w-lg">{f.desc}</p>
              </div>

              {/* Numbered label */}
              <div className="relative mt-6">
                <span className="text-6xl font-black text-white/[0.03] group-hover:text-white/[0.06] transition-colors duration-300">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            </motion.div>
          )}
        </div>
        </div>
      </section>

      {/* ─── Payment & Fees ─── */}
      <section id="pricing" className="bg-card/30 border-y border-border/50">
        <div className="container py-20 md:py-28">
          <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
            <span className="inline-flex items-center gap-0 text-xs font-medium uppercase tracking-widest text-primary"><span className="w-1 h-5 rounded-full bg-primary mr-3" />Pagamentos & Taxas</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Custo sob controle,{" "}
              <span className="text-gradient-primary">performance sem limite</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Tenha acesso a taxas justas e adaptadas ao seu volume. Sem complicações, apenas resultados.
            </p>
          </motion.div>

          {/* Fee Cards — Side by Side like BlackCatPay */}
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6 mb-10">
            {/* PIX Card */}
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.1, duration: 0.6 }}
              whileHover={{ y: -5 }}
              className="relative rounded-3xl border border-primary/30 bg-background p-8 space-y-4 overflow-hidden">
              
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Pix</h3>
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">D+0</span>
                </div>
                <div className="mt-6 space-y-1">
                  <p className="text-4xl md:text-5xl font-extrabold text-primary">Taxa Zero</p>
                  <p className="text-sm text-muted-foreground">para o seu cliente</p>
                </div>
                <div className="mt-6 pt-6 border-t border-border/30 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>Recebimento <strong className="text-foreground">instantâneo</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>QR Code gerado automaticamente</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>Confirmação automática</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Card de Crédito */}
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.2, duration: 0.6 }}
              whileHover={{ y: -5 }}
              className="relative rounded-3xl border border-border/50 bg-background p-8 space-y-4 overflow-hidden">
              
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-accent/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Cartão de Crédito</h3>
                  <span className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">D+30</span>
                </div>
                <div className="mt-6 space-y-1">
                  <p className="text-4xl md:text-5xl font-extrabold text-foreground">3,99%</p>
                  <p className="text-sm text-muted-foreground">+ R$ 2,49 fixo por transação</p>
                </div>
                <div className="mt-6 pt-6 border-t border-border/30 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>Receba em até <strong className="text-foreground">30 dias</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>Parcelamento em até 12x</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="h-4 w-4 text-warning shrink-0" />
                    <span>Antecipação <strong className="text-foreground">D+2</strong>: 4,99% + R$ 2,49</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* CTA + VitraPay Card */}
          <motion.div
            {...fadeUp}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="max-w-5xl mx-auto rounded-3xl border border-border/50 bg-background overflow-hidden shadow-xl shadow-black/5">
            
            <div className="grid md:grid-cols-[1fr_auto] items-stretch">
              <div className="p-8 md:p-10 space-y-6">
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight">Saque rápido via Pix</h3>
                <div className="space-y-0">
                  {[
                  { label: "Saque mínimo:", desc: "R$ 10,00 direto na sua chave Pix" },
                  { label: "Sem mensalidade:", desc: "Pague apenas quando vender" },
                  { label: "Sem taxa de adesão:", desc: "Crie sua conta 100% grátis" }].
                  map((item, i) =>
                  <div key={i} className="flex items-center gap-3 py-4 border-b border-border/30 last:border-b-0">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      <p className="text-sm md:text-base text-muted-foreground">
                        <span className="font-semibold text-foreground">{item.label}</span>{" "}{item.desc}
                      </p>
                    </div>
                  )}
                </div>
                <Button size="lg" className="mt-4 h-13 px-8 text-base font-semibold gap-2 rounded-full glow-primary-strong shimmer-gold" asChild>
                  <Link to="/auth">
                    CRIE SUA CONTA <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* VitraPay Metallic Credit Card */}
              <div className="relative flex items-center justify-center p-4 md:p-10 md:min-w-[400px]">
                <div
                  className="relative w-full max-w-[520px] aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl animate-card-float"
                  style={{ perspective: "1000px", transformStyle: "preserve-3d" }}>
                  
                  <div className="absolute inset-0" style={{
                    background: `linear-gradient(145deg, 
                      hsl(48, 80%, 78%) 0%, hsl(45, 75%, 68%) 20%, hsl(43, 70%, 62%) 40%, 
                      hsl(46, 80%, 72%) 60%, hsl(48, 85%, 76%) 80%, hsl(44, 70%, 65%) 100%)`
                  }} />
                  <div className="absolute inset-0" style={{
                    backgroundImage: `
                      radial-gradient(ellipse at 30% 20%, hsla(0,0%,100%,0.45), transparent 50%),
                      radial-gradient(ellipse at 80% 80%, hsla(0,0%,100%,0.1), transparent 40%),
                      linear-gradient(160deg, transparent 35%, hsla(0,0%,100%,0.2) 48%, hsla(0,0%,100%,0.08) 52%, transparent 65%)
                    `
                  }} />
                  <div className="absolute inset-0 shimmer-gold" />
                  <div className="relative h-full flex flex-col justify-between p-6 md:p-8">
                    <div className="flex items-center">
                      <img src={logoCard} alt="VitraPay" className="h-10 md:h-12" style={{ filter: 'brightness(0) opacity(0.5)' }} />
                    </div>
                    <div className="flex items-center">
                      <div className="w-12 h-10 md:w-14 md:h-11 rounded-md" style={{
                        background: `linear-gradient(135deg, hsl(45, 30%, 72%) 0%, hsl(43, 25%, 65%) 40%, hsl(46, 35%, 75%) 70%, hsl(44, 28%, 68%) 100%)`,
                        boxShadow: 'inset 0 0 0 0.5px hsla(40, 20%, 50%, 0.4), 0 1px 3px hsla(0,0%,0%,0.1)'
                      }}>
                        <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-[1px] p-[3px]">
                          {[...Array(6)].map((_, i) =>
                          <div key={i} className="rounded-[1px]" style={{ background: 'hsla(40, 20%, 55%, 0.35)' }} />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-sm md:text-base font-semibold tracking-widest uppercase" style={{ color: 'hsla(40, 25%, 30%, 0.55)' }}>Seu nome</p>
                      <span className="text-xl md:text-2xl font-black tracking-tight italic" style={{ color: 'hsla(40, 30%, 30%, 0.5)' }}>VISA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Condições especiais */}
          <motion.div {...fadeUp} transition={{ delay: 0.4, duration: 0.6 }} className="max-w-5xl mx-auto mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              💎 <strong className="text-foreground">Condições especiais</strong> para volumes elevados.{" "}
              <a href="https://wa.me/5543984668997" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
                Fale com nossa equipe →
              </a>
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Fee Simulator Section ─── */}
      <section id="simulador" className="relative overflow-hidden bg-white">
        <div className="container relative py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left – Copy */}
            <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm text-amber-700">
                <Wallet className="h-3.5 w-3.5" /> Simulador de Taxas
              </span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight text-gray-900">
                Menos taxas.<br />Mais lucros no <span className="text-primary">seu bolso.</span>
              </h2>
              <p className="text-gray-500 text-lg max-w-md">
                Simule agora e descubra na hora qual plataforma te entrega mais lucro no final do mês.
              </p>
              <div className="h-1 w-16 rounded-full bg-primary" />
            </motion.div>

            {/* Right – Simulator Card */}
            <motion.div {...fadeUp} transition={{ delay: 0.2, duration: 0.6 }}>
              <FeeSimulatorCard />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Smart Payment Section ─── */}
      <section className="relative overflow-hidden bg-card/30 border-y border-border/50">
        <div className="container py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left – Text */}
            <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
                <CreditCard className="h-3.5 w-3.5" /> Pagamento Inteligente
              </span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
                Aumente suas aprovações com nosso{" "}
                <span className="text-gradient-primary">sistema inteligente</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Até <strong className="text-foreground">+18% em aprovações</strong> com retentativa de cobrança automática em diversos operadores caso um pagamento seja recusado.
              </p>
              <div className="space-y-4 pt-2">
                {[
                  "Processamento multi-adquirente para maximizar aprovações",
                  "Retentativa de cobrança automática e transparente",
                  "Redução de chargebacks com antifraude inteligente",
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right – Phone mockup image */}
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="flex justify-center">
              <img
                src={celularVitra}
                alt="VitraPay - Vendas aprovadas com sistema inteligente"
                className="w-[320px] md:w-[420px] drop-shadow-2xl"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── App Coming Soon ─── */}
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
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                  App Store — Em breve
                </Button>
                <Button variant="outline" className="h-12 px-6 gap-2 border-border/50" disabled>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 1.33a1.004 1.004 0 010 1.724l-2.302 1.33-2.498-2.498 2.498-2.886zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z" /></svg>
                  Google Play — Em breve
                </Button>
              </div>
            </motion.div>
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.2, duration: 0.6 }}
              whileHover={{ scale: 1.03 }}
              className="flex justify-center">
              <img
                src={iphone3dMockup}
                alt="Dashboard VitraPay no iPhone"
                className="w-[300px] md:w-[380px] drop-shadow-2xl"
                loading="lazy"
                decoding="async" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Integrations Section ─── */}
      <section className="relative overflow-hidden bg-white">
        <div className="container relative py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left – Copy */}
            <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="space-y-6">
              <span className="inline-flex items-center gap-0 text-xs font-medium uppercase tracking-widest text-primary">
                <span className="w-1 h-5 rounded-full bg-primary mr-3" />
                Integrações
              </span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight text-gray-900">
                Integrações amplas e{" "}
                <span className="text-primary">flexíveis:</span>
              </h2>
              <p className="text-gray-500 text-lg max-w-md leading-relaxed">
                Conecte-se com as <strong className="text-gray-800">principais plataformas</strong> e serviços do mercado para automatizar seu negócio e maximizar seus resultados.
              </p>
              <p className="text-gray-500 text-lg max-w-md leading-relaxed">
                <strong className="text-gray-800">Não encontrou a integração que precisa?</strong> Entre em contato com nossa equipe e iremos desenvolver a integração <strong className="text-gray-800">sob medida</strong> para você.
              </p>
            </motion.div>

            {/* Right – Orbit Image with spin-in animation */}
            <motion.div
              initial={{ opacity: 0, x: 200, rotate: 90 }}
              whileInView={{ opacity: 1, x: 0, rotate: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ type: "spring", damping: 20, stiffness: 60, duration: 1.2 }}
              className="flex justify-center"
            >
              <motion.img
                src={integrationsOrbit}
                alt="Integrações VitraPay — Facebook, TikTok, UTMify, WhatsApp e mais"
                className="w-full max-w-xl md:max-w-2xl"
                animate={{ rotate: [0, 3, -3, 2, -2, 0] }}
                transition={{
                  rotate: {
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
                }}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="testimonials" className="bg-card/30 border-y border-border/50">
        <div className="container py-20 md:py-28">
          <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
            <span className="inline-flex items-center gap-0 text-xs font-medium uppercase tracking-widest text-primary"><span className="w-1 h-5 rounded-full bg-primary mr-3" />Depoimentos</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Quem usa, <span className="text-gradient-primary">recomenda</span>
            </h2>
          </motion.div>
          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) =>
            <motion.div
              key={t.name}
              {...stagger}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -5 }}
              className="rounded-2xl border border-border/50 bg-background p-7 space-y-4 hover:border-primary/20 transition-all duration-300">
              
                <div className="flex gap-0.5">
                  {[...Array(t.stars)].map((_, j) =>
                <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-primary/20">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-primary/70 font-medium">{t.handle}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Placas de Premiação ─── */}
      <section className="bg-white py-20 md:py-28">
        <div className="container">
          <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="max-w-7xl mx-auto">
            {/* Imagem das placas */}
            <div className="flex justify-center mb-12">
              <img
                src={placasVitraPay}
                alt="Placas de Premiação VitraPay — 10K, 100K, 250K, 500K e 1 Milhão faturados"
                className="w-full max-w-7xl"
                loading="lazy"
                decoding="async"
              />
            </div>

            {/* Texto */}
            <div className="grid md:grid-cols-[1.2fr_1fr] gap-8 items-end">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
                Destaque-se{" "}
                <br className="hidden md:block" />
                com a{" "}
                <span className="text-[hsl(48,96%,53%)]">VitraPay!</span>
              </h2>
              <div className="space-y-4">
                <p className="text-gray-600 text-base md:text-lg leading-relaxed">
                  Ultrapasse suas metas, atinja novos níveis de faturamento e celebre suas conquistas com as Placas de Premiação da VitraPay.
                </p>
                <p className="text-gray-600 text-base md:text-lg leading-relaxed">
                  Ganhe prêmios incríveis, desfrute de viagens exclusivas e tratamento VIP. Seu sucesso merece ser reconhecido e celebrado!
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Membros Black Carousel ─── */}
      <section className="container py-20 md:py-28">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
          <span className="inline-flex items-center gap-0 text-xs font-medium uppercase tracking-widest text-primary"><span className="w-1 h-5 rounded-full bg-primary mr-3" />Comunidade</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Nossos <span className="text-gradient-primary">Membros Black</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Conheça quem já faz parte da elite VitraPay e está escalando resultados todos os dias.
          </p>
        </motion.div>

        <MembrosBlackCarousel />
      </section>

      {/* ─── FAQ Section ─── */}
      <section id="faq" className="container py-20 md:py-28">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="text-center space-y-4 mb-16">
          <span className="inline-flex items-center gap-0 text-xs font-medium uppercase tracking-widest text-primary"><span className="w-1 h-5 rounded-full bg-primary mr-3" />Dúvidas frequentes</span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Perguntas <span className="text-gradient-primary">frequentes</span>
          </h2>
        </motion.div>

        <motion.div {...fadeUp} transition={{ delay: 0.2, duration: 0.6 }} className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, i) =>
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="rounded-2xl border border-border/50 bg-card/50 px-6 data-[state=open]:border-primary/30 transition-colors">
              
                <AccordionTrigger className="hover:no-underline text-left gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-black text-primary/30 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm md:text-base font-semibold">{item.q}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-14 text-sm text-muted-foreground leading-relaxed">
                  {item.a === "HELP_LINK" ? (
                    <span>Para dúvidas relacionadas à sua compra, <Link to="/help" className="text-primary hover:underline font-medium">clique aqui</Link>.</span>
                  ) : item.a}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </motion.div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="container pb-20 md:pb-28">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }}
        className="relative rounded-3xl border border-primary/20 bg-primary/5 overflow-hidden">
          
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
              <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold gap-2 border-border/50" asChild>
                <a href="https://wa.me/5543984668997" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Falar com especialista
                </a>
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

      {/* ─── Footer ─── */}
      <footer className="relative bg-[#080808] overflow-hidden">
        {/* Golden gradient at top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(48,96%,53%)] to-transparent opacity-40" />
        <div className="absolute -top-[200px] left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[hsl(48,96%,53%)]/[0.08] rounded-full blur-[100px] pointer-events-none" />
        
        {/* Yellow glow — subtle, only peeking from bottom */}
        <div className="absolute -bottom-[350px] left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-[hsl(48,96%,53%)]/[0.12] rounded-full blur-[100px] pointer-events-none" />

        <div className="container relative z-10 pt-20 pb-8">
          {/* Main footer grid */}
          <div className="grid gap-10 md:grid-cols-12 pb-16 border-b border-white/[0.06]">
            {/* Brand */}
            <div className="md:col-span-3 space-y-5">
              <ThemeLogo variant="horizontal" className="h-8 object-contain" />
              <p className="text-[13px] text-white/40 leading-relaxed">
                A plataforma completa para vender produtos digitais com alta conversão.
              </p>
              <div className="flex items-center gap-2.5 pt-1">
                <a href="https://instagram.com/vitrapay" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all">
                  <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href="#" className="w-9 h-9 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all">
                  <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><polygon fill="#080808" points="9.545,15.568 15.818,12 9.545,8.432"/></svg>
                </a>
              </div>
            </div>

            {/* Navegue */}
            <div className="md:col-span-2 space-y-5">
              <h4 className="text-[13px] font-semibold text-white/70 tracking-wide">Navegue</h4>
              <div className="flex flex-col gap-3">
                <a href="#features" className="text-[13px] text-white/35 hover:text-white transition-colors">Recursos</a>
                <a href="#pricing" className="text-[13px] text-white/35 hover:text-white transition-colors">Taxas</a>
                <a href="#smart-payment" className="text-[13px] text-white/35 hover:text-white transition-colors">Benefícios</a>
                <a href="#why-us" className="text-[13px] text-white/35 hover:text-white transition-colors">Por que nos escolher</a>
                <Link to="/faq" className="text-[13px] text-white/35 hover:text-white transition-colors">FAQ</Link>
              </div>
            </div>

            {/* Transparência */}
            <div className="md:col-span-2 space-y-5">
              <h4 className="text-[13px] font-semibold text-white/70 tracking-wide">Transparência</h4>
              <div className="flex flex-col gap-3">
                <Link to="/privacy" className="text-[13px] text-white/35 hover:text-white transition-colors">Política de privacidade</Link>
                <Link to="/terms" className="text-[13px] text-white/35 hover:text-white transition-colors">Termos de uso</Link>
                <Link to="/purchase-terms" className="text-[13px] text-white/35 hover:text-white transition-colors">Termos de compra</Link>
              </div>
            </div>

            {/* Redes sociais */}
            <div className="md:col-span-2 space-y-5">
              <h4 className="text-[13px] font-semibold text-white/70 tracking-wide">Redes sociais</h4>
              <div className="flex flex-col gap-3">
                <a href="https://instagram.com/vitrapay" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[13px] text-white/35 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  Instagram
                </a>
              </div>
            </div>

            {/* Gerentes de conta */}
            <div className="md:col-span-3 space-y-5">
              <h4 className="text-[13px] font-semibold text-white/70 tracking-wide">Gerentes de conta</h4>
              <div className="space-y-2.5">
                <a href="https://wa.me/5543984668997" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] hover:border-white/15 transition-colors group">
                  <svg className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  <span className="text-[13px] text-white/35 group-hover:text-white transition-colors">+55 43 98466 8997</span>
                </a>
                <a href="mailto:suporte@vitrapay.com.br" className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] hover:border-white/15 transition-colors group">
                  <svg className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                  <span className="text-[13px] text-white/35 group-hover:text-white transition-colors">suporte@vitrapay.com.br</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-white/[0.06] rounded-full pl-1 pr-4 py-1">
              <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-[hsl(48,96%,53%)] text-black tracking-wider">CNPJ</span>
              <span className="text-[12px] text-white/40">63.662.008/0001-33</span>
            </div>
            <span className="text-[12px] text-white/25">© 2026 VitraPay Tecnologia Ltda. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>

      {/* WhatsApp flutuante — desativado por enquanto */}
    </div>);

}