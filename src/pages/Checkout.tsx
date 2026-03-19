import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCheckoutPixels, firePixelEvent } from "@/components/checkout/CheckoutPixels";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Clock,
  Tag,
  CreditCard,
  Loader2,
  QrCode,
  Lock,
  CheckCircle2,
  Star,
  ArrowDownToLine,
  User,
  Mail,
  Phone,
  FileText,
} from "lucide-react";

type PaymentMethod = "card" | "pix";

function CheckoutBlockRenderer({ block }: { block: any }) {
  const c = block.config || {};
  switch (block.block_type) {
    case "headline":
      return (
        <div style={{ textAlign: c.align || "center" }}>
          <h2 className={`text-${c.size || "2xl"} ${c.bold ? "font-bold" : ""}`} style={{ color: "hsl(0,0%,95%)" }}>
            {c.text || ""}
          </h2>
        </div>
      );
    case "text":
      return (
        <p className={`text-${c.size || "base"}`} style={{ textAlign: c.align || "left", color: "hsl(240,5%,70%)" }}>
          {c.content || ""}
        </p>
      );
    case "image":
      return c.url ? (
        <div className={`${c.fullWidth ? "w-full" : "max-w-md mx-auto"} aspect-[21/9] rounded-xl overflow-hidden`}>
          <img src={c.url} alt={c.alt || ""} className="w-full h-full object-cover" />
        </div>
      ) : null;
    case "benefits":
      return (
        <div className="rounded-xl p-5 space-y-2" style={{ background: "hsl(240, 10%, 8%)", border: "1px solid hsl(240, 5%, 15%)" }}>
          {(c.items || []).map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm" style={{ color: "hsl(0,0%,90%)" }}>
              <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "hsl(270, 52%, 58%)" }} />
              {item}
            </div>
          ))}
        </div>
      );
    case "badge": {
      const colors: Record<string, string> = {
        green: "hsl(270, 52%, 49%)",
        gold: "hsl(38, 92%, 50%)",
        blue: "hsl(210, 100%, 50%)",
      };
      const bg = colors[c.style || "green"];
      return (
        <div className="flex items-center justify-center gap-2 rounded-xl py-3 px-5 text-sm font-semibold" style={{ background: `${bg}20`, color: bg, border: `1px solid ${bg}40` }}>
          <ShieldCheck className="h-4 w-4" />
          {c.text || "Selo"}
        </div>
      );
    }
    case "timer":
      return (
        <div className="py-3.5 rounded-xl flex items-center justify-center gap-4" style={{ background: "hsl(38, 92%, 50%)", color: "hsl(0,0%,5%)" }}>
          <Clock className="h-5 w-5" />
          <span className="text-sm font-bold">{c.text || "Oferta expira em:"}</span>
          <span className="text-xl font-black tabular-nums">{String(c.minutes || 15).padStart(2, "0")}:00</span>
        </div>
      );
    case "testimonial":
      return (
        <div className="rounded-xl p-4 space-y-2" style={{ background: "hsl(240, 10%, 8%)", border: "1px solid hsl(240, 5%, 15%)" }}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "hsl(270, 52%, 49%, 0.2)", color: "hsl(270, 52%, 58%)" }}>
              {(c.author || "A").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "hsl(0,0%,90%)" }}>{c.author || "Autor"}</p>
              <div className="flex gap-0.5">
                {Array.from({ length: c.rating || 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-[hsl(38,92%,50%)]" style={{ color: "hsl(38, 92%, 50%)" }} />
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "hsl(240,5%,60%)" }}>{c.content || ""}</p>
        </div>
      );
    case "video": {
      let embedUrl = c.url || "";
      try {
        const u = new URL(embedUrl);
        if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
          const vid = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : u.searchParams.get("v");
          embedUrl = `https://www.youtube.com/embed/${vid}`;
        } else if (u.hostname.includes("vimeo.com")) {
          embedUrl = `https://player.vimeo.com/video/${u.pathname.split("/").pop()}`;
        }
      } catch {}
      return embedUrl ? (
        <div className="aspect-video rounded-xl overflow-hidden">
          <iframe src={embedUrl} className="w-full h-full" allowFullScreen />
        </div>
      ) : null;
    }
    default:
      return null;
  }
}

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [product, setProduct] = useState<any>(null);
  const [producer, setProducer] = useState<string>("");
  const [orderBumps, setOrderBumps] = useState<any[]>([]);
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");

  const [form, setForm] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    cardHolder: "",
    installments: "1",
  });

  const [checkoutBlocks, setCheckoutBlocks] = useState<any[]>([]);
  const [productPixels, setProductPixels] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const loadCheckout = async () => {
      const { data: prod } = await supabase.from("products").select("*").eq("id", id).single();
      if (prod) {
        setProduct(prod);
        if (prod.checkout_timer_minutes && prod.checkout_timer_minutes > 0) {
          setTimeLeft(prod.checkout_timer_minutes * 60);
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", prod.producer_id)
          .maybeSingle();
        setProducer(profile?.display_name || "");
      }

      const { data: bumps } = await supabase
        .from("order_bumps")
        .select("*, bump_product:bump_product_id(*)")
        .eq("product_id", id)
        .eq("is_active", true);
      if (bumps) setOrderBumps(bumps);

      const { data: testis } = await supabase
        .from("checkout_testimonials")
        .select("*")
        .eq("product_id", id)
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (testis) setTestimonials(testis);

      const { data: blocks } = await supabase
        .from("checkout_blocks")
        .select("*")
        .eq("product_id", id)
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (blocks) setCheckoutBlocks(blocks);

      // Load pixels
      const { data: pxs } = await supabase
        .from("product_pixels")
        .select("*")
        .eq("product_id", id)
        .eq("is_active", true);
      if (pxs) setProductPixels(pxs);

      setLoading(false);
    };
    loadCheckout();
  }, [id]);

  // Inject pixel scripts
  useCheckoutPixels(productPixels);

  // Fire InitiateCheckout when pixels are loaded
  useEffect(() => {
    if (productPixels.length > 0) {
      firePixelEvent(productPixels, "InitiateCheckout");
    }
  }, [productPixels]);

  useEffect(() => {
    if (user?.email) setForm((f) => ({ ...f, email: user.email || "" }));
  }, [user]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTime = (s: number) => ({
    min: Math.floor(s / 60).toString().padStart(2, "0"),
    sec: (s % 60).toString().padStart(2, "0"),
  });

  const updateForm = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const formatCPF = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim();

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const applyCoupon = async () => {
    if (!couponCode.trim() || !product) return;
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", couponCode.trim().toUpperCase())
      .eq("producer_id", product.producer_id)
      .eq("is_active", true)
      .single();
    if (data) {
      if (data.max_uses && (data.uses ?? 0) >= data.max_uses) {
        toast({ title: "Cupom esgotado", variant: "destructive" });
        return;
      }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast({ title: "Cupom expirado", variant: "destructive" });
        return;
      }
      setAppliedCoupon(data);
      toast({ title: "Cupom aplicado!" });
    } else {
      toast({ title: "Cupom inválido", variant: "destructive" });
    }
  };

  const toggleBump = (bumpId: string) => {
    setSelectedBumps((prev) => {
      const next = new Set(prev);
      next.has(bumpId) ? next.delete(bumpId) : next.add(bumpId);
      return next;
    });
  };

  const calculateTotal = () => {
    if (!product) return 0;
    let total = product.price;
    for (const bump of orderBumps) {
      if (selectedBumps.has(bump.id)) {
        const bp = bump.bump_product?.price || 0;
        total += bp * (1 - (bump.discount_percentage || 0) / 100);
      }
    }
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === "percentage") {
        total *= 1 - appliedCoupon.discount_value / 100;
      } else {
        total = Math.max(0, total - appliedCoupon.discount_value);
      }
    }
    return Math.round(total);
  };

  const handlePurchase = async () => {
    if (!form.name || !form.email) {
      toast({ title: "Preencha seus dados", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const affiliateRef = searchParams.get("ref") || null;
      const total = calculateTotal();
      const { data, error } = await supabase.functions.invoke("process-purchase", {
        body: {
          product_id: id,
          buyer_email: form.email,
          buyer_name: form.name,
          amount: total,
          payment_method: paymentMethod,
          affiliate_ref: affiliateRef,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPurchaseResult(data);
      firePixelEvent(productPixels, "Purchase", total);
    } catch (err: any) {
      toast({ title: "Erro no pagamento", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  // ── Success Screen ──
  if (purchaseResult) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(240,10%,4%)", color: "hsl(0,0%,95%)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full rounded-2xl p-8 text-center space-y-5"
          style={{ background: "hsl(240,10%,8%)", border: "1px solid hsl(240,5%,15%)" }}
        >
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "hsl(270,52%,49%,0.15)" }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: "hsl(270,52%,58%)" }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Compra Confirmada!</h1>
          <p className="text-sm" style={{ color: "hsl(240,5%,60%)" }}>
            Seu acesso a <strong style={{ color: "hsl(0,0%,90%)" }}>{purchaseResult.product_title}</strong> está liberado.
          </p>
          <div className="rounded-xl p-4 space-y-2" style={{ background: "hsl(240,10%,6%)", border: "1px solid hsl(240,5%,12%)" }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: "hsl(240,5%,50%)" }}>Valor pago</span>
              <span className="font-bold">R$ {(purchaseResult.amount / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "hsl(240,5%,50%)" }}>ID da venda</span>
              <span className="font-mono text-[0.6rem]">{purchaseResult.sale_id?.slice(0, 8)}</span>
            </div>
          </div>
          {purchaseResult.file_url && (
            <Button
              className="w-full h-12 text-sm font-bold gap-2 rounded-xl"
              style={{ background: "hsl(270,52%,49%)", color: "white" }}
              onClick={() => window.open(purchaseResult.file_url, "_blank")}
            >
              <ArrowDownToLine className="h-4 w-4" /> Baixar Produto
            </Button>
          )}
          {purchaseResult.product_type === "lms" && (
            <Button
              className="w-full h-12 text-sm font-bold gap-2 rounded-xl"
              style={{ background: "hsl(270,52%,49%)", color: "white" }}
              onClick={() => toast({ title: "Acesse com seu email", description: "Faça login para acessar a área de membros." })}
            >
              Acessar Área de Membros
            </Button>
          )}
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(240,10%,4%)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[hsl(240,10%,4%)] flex items-center justify-center">
        <p className="text-[hsl(240,5%,60%)]">Produto não encontrado.</p>
      </div>
    );
  }

  const total = calculateTotal();
  const time = formatTime(timeLeft);

  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const val = (total / 100 / n).toFixed(2);
    return { value: String(n), label: `${n}x de R$ ${val}${n > 1 ? " *" : ""}` };
  });

  return (
    <div className="min-h-screen" style={{ background: "hsl(240, 10%, 4%)", color: "hsl(0, 0%, 95%)" }}>
      {/* ── Timer Bar ── */}
      {timeLeft > 0 && (
        <div className="py-3.5" style={{ background: "hsl(38, 92%, 50%)", color: "hsl(0,0%,5%)" }}>
          <div className="container max-w-5xl flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center justify-center rounded px-2.5 py-1 text-xl font-black tabular-nums" style={{ background: "hsla(0,0%,0%,0.15)" }}>
                  {time.min}
                </span>
                <span className="text-xl font-black">:</span>
                <span className="inline-flex items-center justify-center rounded px-2.5 py-1 text-xl font-black tabular-nums" style={{ background: "hsla(0,0%,0%,0.15)" }}>
                  {time.sec}
                </span>
              </div>
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold hidden sm:block">Tempo está acabando!</p>
          </div>
        </div>
      )}

      {/* ── Headline Banner ── */}
      {product.checkout_headline && (
        <div className="py-2.5 text-center text-sm font-bold tracking-wide" style={{ background: "hsl(270, 52%, 49%)", color: "white" }}>
          {product.checkout_headline}
        </div>
      )}

      {/* ── Banner Images ── */}
      {product.checkout_banner_url && (
        <div className="w-full">
          <img src={product.checkout_banner_url} alt="Banner" className="w-full max-h-[320px] object-cover" />
        </div>
      )}

      {/* ── Dynamic Blocks ── */}
      {checkoutBlocks.length > 0 && (
        <div className="container max-w-5xl px-4 py-4 space-y-4">
          {checkoutBlocks.map((block: any) => (
            <CheckoutBlockRenderer key={block.id} block={block} />
          ))}
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="container max-w-5xl py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT COLUMN - Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-3 space-y-5"
          >
            {/* Product Info Card */}
            <div className="rounded-xl p-5" style={{ background: "hsl(240, 10%, 8%)", border: "1px solid hsl(240, 5%, 15%)" }}>
              <div className="flex items-start gap-4">
                {product.cover_url && (
                  <img src={product.cover_url} alt={product.title} className="h-16 w-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-lg">{product.title}</h2>
                  <p className="text-primary text-lg font-bold mt-1">
                    R$ {(product.price / 100).toFixed(2)}
                    <span className="text-xs font-normal ml-1" style={{ color: "hsl(240,5%,50%)" }}>cash</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: "hsl(240, 10%, 8%)", border: "1px solid hsl(240, 5%, 15%)" }}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Informações de Contato
              </h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs" style={{ color: "hsl(240,5%,55%)" }}>Nome completo</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(240,5%,40%)" }} />
                    <Input
                      placeholder="Preencha seu nome completo"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      className="pl-10 border-0 h-11"
                      style={{ background: "hsl(240, 10%, 12%)", color: "hsl(0,0%,90%)" }}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs" style={{ color: "hsl(240,5%,55%)" }}>Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(240,5%,40%)" }} />
                    <Input
                      type="email"
                      placeholder="name@email.com"
                      value={form.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      className="pl-10 border-0 h-11"
                      style={{ background: "hsl(240, 10%, 12%)", color: "hsl(0,0%,90%)" }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs" style={{ color: "hsl(240,5%,55%)" }}>CPF / CNPJ</Label>
                    <div className="relative mt-1">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(240,5%,40%)" }} />
                      <Input
                        placeholder="000.000.000-00"
                        value={form.cpf}
                        onChange={(e) => updateForm("cpf", formatCPF(e.target.value))}
                        className="pl-10 border-0 h-11"
                        style={{ background: "hsl(240, 10%, 12%)", color: "hsl(0,0%,90%)" }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: "hsl(240,5%,55%)" }}>Celular</Label>
                    <div className="flex gap-1.5 mt-1">
                      <div className="flex items-center gap-1 rounded-md px-3 text-xs shrink-0 h-11" style={{ background: "hsl(240, 10%, 12%)", color: "hsl(240,5%,50%)" }}>
                        🇧🇷 +55
                      </div>
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(240,5%,40%)" }} />
                        <Input
                          placeholder="(00) 00000-0000"
                          value={form.phone}
                          onChange={(e) => updateForm("phone", formatPhone(e.target.value))}
                          className="pl-10 border-0 h-11"
                          style={{ background: "hsl(240, 10%, 12%)", color: "hsl(0,0%,90%)" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: "hsl(240, 10%, 8%)", border: "1px solid hsl(240, 5%, 15%)" }}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Método de Pagamento
              </h3>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {(["pix", "card"] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className="flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-all whitespace-nowrap"
                    style={{
                      background: paymentMethod === method ? "hsl(158, 94%, 30%)" : "hsl(240, 10%, 12%)",
                      color: paymentMethod === method ? "white" : "hsl(240, 5%, 60%)",
                      border: paymentMethod === method ? "1px solid hsl(158, 94%, 35%)" : "1px solid hsl(240, 5%, 18%)",
                    }}
                  >
                    {method === "pix" ? <QrCode className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    {method === "pix" ? "Pix" : "Cartão de Crédito"}
                  </button>
                ))}
              </div>

              {paymentMethod === "card" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3"
                >
                  <div>
                    <Label className="text-xs" style={{ color: "hsl(240,5%,55%)" }}>Número do cartão</Label>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={form.cardNumber}
                      onChange={(e) => updateForm("cardNumber", formatCardNumber(e.target.value))}
                      className="mt-1 border-0 h-11"
                      style={{ background: "hsl(240, 10%, 12%)", color: "hsl(0,0%,90%)" }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs" style={{ color: "hsl(240,5%,55%)" }}>Vencimento</Label>
                      <Input
                        placeholder="MM/AA"
                        value={form.cardExpiry}
                        onChange={(e) => updateForm("cardExpiry", formatExpiry(e.target.value))}
                        className="mt-1 border-0 h-11"
                        style={{ background: "hsl(240, 10%, 12%)", color: "hsl(0,0%,90%)" }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs" style={{ color: "hsl(240,5%,55%)" }}>CVV</Label>
                      <Input
                        placeholder="000"
                        value={form.cardCvv}
                        onChange={(e) => updateForm("cardCvv", e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="mt-1 border-0 h-11"
                        style={{ background: "hsl(240, 10%, 12%)", color: "hsl(0,0%,90%)" }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: "hsl(240,5%,55%)" }}>Parcelas</Label>
                    <select
                      value={form.installments}
                      onChange={(e) => updateForm("installments", e.target.value)}
                      className="mt-1 flex h-11 w-full rounded-md px-3 py-2 text-sm border-0"
                      style={{ background: "hsl(240, 10%, 12%)", color: "hsl(0,0%,90%)" }}
                    >
                      {installmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "hsl(240,5%,45%)" }}>
                    <Lock className="h-3 w-3" />
                    Seus dados de pagamento são criptografados e processados de forma segura.
                  </div>
                </motion.div>
              )}

              {paymentMethod === "pix" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-lg p-6 text-center space-y-2"
                  style={{ background: "hsl(240, 10%, 12%)" }}
                >
                  <QrCode className="h-12 w-12 mx-auto text-primary" />
                  <p className="text-sm font-medium">Pagamento via PIX</p>
                  <p className="text-xs" style={{ color: "hsl(240,5%,50%)" }}>
                    Ao clicar em "Pagar", um QR Code será gerado para pagamento instantâneo.
                  </p>
                </motion.div>
              )}
            </div>

            {/* Order Bumps */}
            {orderBumps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-center" style={{ color: "hsl(38, 92%, 50%)" }}>
                  ⚡ Ofertas limitadas
                </h3>
                {orderBumps.map((bump) => {
                  const bumpPrice = bump.bump_product?.price || 0;
                  const discountedPrice = bumpPrice * (1 - (bump.discount_percentage || 0) / 100);
                  const isSelected = selectedBumps.has(bump.id);

                  return (
                    <motion.div
                      key={bump.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleBump(bump.id)}
                      className="rounded-xl p-4 cursor-pointer transition-all"
                      style={{
                        background: isSelected ? "hsl(158, 94%, 30%, 0.1)" : "hsl(240, 10%, 8%)",
                        border: isSelected ? "2px solid hsl(158, 94%, 30%)" : "2px solid hsl(240, 5%, 15%)",
                      }}
                    >
                      {bump.title && (
                        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: "hsl(38, 92%, 50%)" }}>
                          {bump.title}
                        </p>
                      )}
                      <div className="flex items-start gap-3">
                        <Checkbox checked={isSelected} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {bump.bump_product?.cover_url && (
                              <img src={bump.bump_product.cover_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                            )}
                            <div>
                              <p className="text-sm font-semibold">{bump.bump_product?.title}</p>
                              {bump.description && (
                                <p className="text-xs mt-0.5" style={{ color: "hsl(240,5%,50%)" }}>{bump.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {bump.discount_percentage > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs line-through" style={{ color: "hsl(240,5%,40%)" }}>
                                R$ {(bumpPrice / 100).toFixed(2)}
                              </span>
                              <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded" style={{ background: "hsl(0, 84%, 60%)", color: "white" }}>
                                {bump.discount_percentage}% OFF
                              </span>
                            </div>
                          )}
                          <span className="text-sm font-bold text-primary">
                            R$ {(discountedPrice / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Coupon */}
            <div className="rounded-xl p-5" style={{ background: "hsl(240, 10%, 8%)", border: "1px solid hsl(240, 5%, 15%)" }}>
              <Label className="text-xs flex items-center gap-1.5 mb-2" style={{ color: "hsl(240,5%,55%)" }}>
                <Tag className="h-3.5 w-3.5" /> Cupom de desconto
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="CÓDIGO DO CUPOM"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="uppercase text-sm border-0 h-11"
                  style={{ background: "hsl(240, 10%, 12%)", color: "hsl(0,0%,90%)" }}
                  disabled={!!appliedCoupon}
                />
                {appliedCoupon ? (
                  <Button variant="outline" size="sm" className="h-11" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}>
                    Remover
                  </Button>
                ) : (
                  <Button size="sm" className="h-11 px-5" onClick={applyCoupon}>Aplicar</Button>
                )}
              </div>
              {appliedCoupon && (
                <p className="text-xs text-primary mt-2 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {appliedCoupon.discount_type === "percentage"
                    ? `${appliedCoupon.discount_value}% off`
                    : `R$ ${(appliedCoupon.discount_value / 100).toFixed(2)} off`}
                </p>
              )}
            </div>
          </motion.div>

          {/* RIGHT COLUMN - Summary + Testimonials */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="lg:col-span-2"
          >
            <div className="sticky top-6 space-y-4">
              {/* Order Summary */}
              <div className="rounded-xl p-5 space-y-4" style={{ background: "hsl(240, 10%, 8%)", border: "1px solid hsl(240, 5%, 15%)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(240,5%,50%)" }}>
                  Resumo do pedido
                </p>
                <div className="flex items-center gap-3">
                  {product.cover_url && (
                    <img src={product.cover_url} alt={product.title} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold truncate">{product.title}</h4>
                  </div>
                  <span className="text-sm font-bold">R$ {(product.price / 100).toFixed(2)}</span>
                </div>

                {Array.from(selectedBumps).map((bId) => {
                  const b = orderBumps.find((ob) => ob.id === bId);
                  if (!b) return null;
                  const bp = b.bump_product?.price || 0;
                  const dp = bp * (1 - (b.discount_percentage || 0) / 100);
                  return (
                    <div key={bId} className="flex justify-between text-sm">
                      <span style={{ color: "hsl(240,5%,55%)" }}>{b.bump_product?.title || b.title}</span>
                      <span>R$ {(dp / 100).toFixed(2)}</span>
                    </div>
                  );
                })}

                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-primary">
                    <span>Desconto</span>
                    <span>
                      -{appliedCoupon.discount_type === "percentage"
                        ? `${appliedCoupon.discount_value}%`
                        : `R$ ${(appliedCoupon.discount_value / 100).toFixed(2)}`}
                    </span>
                  </div>
                )}

                <Separator style={{ background: "hsl(240, 5%, 15%)" }} />

                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-xl font-black text-primary">
                    R$ {(total / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Buy Button */}
              <Button
                onClick={handlePurchase}
                disabled={processing}
                className="w-full h-14 text-base font-bold gap-2 rounded-xl"
                size="lg"
                style={{ background: "hsl(158, 94%, 30%)", color: "white" }}
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : paymentMethod === "pix" ? (
                  <>
                    <QrCode className="h-5 w-5" /> Pagar com PIX
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" /> Pagar com Cartão de Crédito
                  </>
                )}
              </Button>

              {/* Trust badges */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "hsl(240,5%,45%)" }}>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Compra 100% segura e criptografada
                </div>
                <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "hsl(240,5%,45%)" }}>
                  <Lock className="h-3.5 w-3.5" />
                  Dados protegidos com SSL
                </div>
              </div>

              {/* Testimonials */}
              {testimonials.length > 0 && (
                <div className="space-y-3 mt-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-center" style={{ color: "hsl(240,5%,50%)" }}>
                    O que dizem nossos alunos
                  </p>
                  {testimonials.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl p-4 space-y-2"
                      style={{ background: "hsl(240, 10%, 8%)", border: "1px solid hsl(240, 5%, 15%)" }}
                    >
                      <div className="flex items-center gap-2">
                        {t.author_avatar_url ? (
                          <img src={t.author_avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "hsl(158, 94%, 30%, 0.2)", color: "hsl(158, 94%, 40%)" }}>
                            {t.author_name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold">{t.author_name}</p>
                          <div className="flex gap-0.5">
                            {Array.from({ length: t.rating || 5 }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-[hsl(38,92%,50%)]" style={{ color: "hsl(38, 92%, 50%)" }} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "hsl(240,5%,60%)" }}>
                        {t.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {producer && (
                <p className="text-[0.6rem] text-center" style={{ color: "hsl(240,5%,35%)" }}>
                  Vendido por @{producer.toLowerCase().replace(/\s+/g, "")}
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
