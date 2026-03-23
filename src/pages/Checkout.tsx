import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCheckoutPixels, firePixelEvent } from "@/components/checkout/CheckoutPixels";
import { SocialProofNotification } from "@/components/checkout/SocialProofNotification";
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
  Copy,
} from "lucide-react";

type PaymentMethod = "card" | "pix";

function CheckoutBlockRenderer({ block }: { block: any }) {
  const c = block.config || {};
  switch (block.block_type) {
    case "headline":
      return (
        <div style={{ textAlign: c.align || "center" }}>
          <h2 className={`text-${c.size || "2xl"} ${c.bold ? "font-bold" : ""}`} style={{ color: "var(--ck-fg)" }}>
            {c.text || ""}
          </h2>
        </div>
      );
    case "text":
      return (
        <p className={`text-${c.size || "base"}`} style={{ textAlign: c.align || "left", color: "var(--ck-muted)" }}>
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
        <div className="rounded-xl p-5 space-y-2" style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}>
          {(c.items || []).map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm" style={{ color: "var(--ck-input-fg)" }}>
              <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "hsl(48, 96%, 45%)" }} />
              {item}
            </div>
          ))}
        </div>
      );
    case "badge": {
      const colors: Record<string, string> = {
        green: "hsl(48, 96%, 53%)",
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
        <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "hsl(48, 96%, 53%, 0.2)", color: "hsl(48, 96%, 45%)" }}>
              {(c.author || "A").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--ck-input-fg)" }}>{c.author || "Autor"}</p>
              <div className="flex gap-0.5">
                {Array.from({ length: c.rating || 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-[hsl(38,92%,50%)]" style={{ color: "hsl(38, 92%, 50%)" }} />
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--ck-muted)" }}>{c.content || ""}</p>
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
  const [funnelSteps, setFunnelSteps] = useState<any[]>([]);
  const [currentFunnelStep, setCurrentFunnelStep] = useState(0);
  const [funnelAccepted, setFunnelAccepted] = useState<Set<string>>(new Set());
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<any>(null);
  const [pixData, setPixData] = useState<{ qrCode: string; copyPaste: string } | null>(null);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
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
    cep: "",
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

      // Load funnel steps (upsell/downsell)
      const { data: fSteps } = await supabase
        .from("funnel_steps")
        .select("*, offer_product:offer_product_id(id, title, price, cover_url, description, file_url, type)")
        .eq("product_id", id)
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (fSteps) setFunnelSteps(fSteps);

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

      // Track affiliate click
      const ref = searchParams.get("ref");
      if (ref) {
        try { await supabase.rpc("increment_affiliate_clicks" as any, { affiliate_id: ref }); } catch {}
      }

      setLoading(false);
    };
    loadCheckout();
  }, [id, searchParams]);

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

  // Polling for PIX payment confirmation
  useEffect(() => {
    if (!asaasPaymentId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("pending_payments")
          .select("status")
          .eq("asaas_payment_id", asaasPaymentId)
          .single();

        if (data?.status === "confirmed") {
          clearInterval(interval);
          setPurchaseResult({
            product_title: product?.title,
            amount: calculateTotal(),
            sale_id: asaasPaymentId,
            product_type: product?.type,
            file_url: product?.file_url,
          });
          toast({ title: "Pagamento confirmado!" });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [asaasPaymentId]);

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

  const formatCEP = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? d.replace(/(\d{5})(\d{1,3})/, "$1-$2") : d;
  };

  const validateCPF = (cpf: string): boolean => {
    const d = cpf.replace(/\D/g, "");
    if (d.length === 14) return true; // CNPJ - basic length check
    if (d.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(d)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== parseInt(d[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    return rest === parseInt(d[10]);
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

  const [cardStatus, setCardStatus] = useState<"idle" | "approved" | "declined" | "pending">("idle");

  const isCardDisabled = paymentMethod === "card" && calculateTotal() < 500;

  const handlePurchase = async () => {
    if (!form.name || !form.email) {
      toast({ title: "Preencha seus dados", variant: "destructive" });
      return;
    }
    if (!form.cpf.replace(/\D/g, "")) {
      toast({ title: "CPF/CNPJ é obrigatório", variant: "destructive" });
      return;
    }
    if (!validateCPF(form.cpf)) {
      toast({ title: "CPF/CNPJ inválido", description: "Verifique o número digitado.", variant: "destructive" });
      return;
    }
    if (paymentMethod === "card") {
      if (!form.cardNumber || !form.cardExpiry || !form.cardCvv || !form.cardHolder) {
        toast({ title: "Preencha todos os dados do cartão", variant: "destructive" });
        return;
      }
      if (!form.cep.replace(/\D/g, "") || form.cep.replace(/\D/g, "").length < 8) {
        toast({ title: "CEP é obrigatório para cartão", variant: "destructive" });
        return;
      }
      if (calculateTotal() < 500) {
        toast({ title: "Valor mínimo para cartão é R$ 5,00", description: "Use PIX para valores menores.", variant: "destructive" });
        return;
      }
    }
    setProcessing(true);
    setCardStatus("idle");
    try {
      const affiliateRef = searchParams.get("ref") || null;
      const total = calculateTotal();

      // Get UTM data from localStorage
      let utmData: Record<string, string> = {};
      try { utmData = JSON.parse(localStorage.getItem("utm_data") || "{}"); } catch {}

      if (paymentMethod === "pix") {
        const { data, error } = await supabase.functions.invoke("create-pix-payment", {
          body: {
            product_id: id,
            buyer_name: form.name,
            buyer_email: form.email,
            buyer_cpf: form.cpf,
            amount: total,
            description: `Compra na VitraPay`,
            affiliate_ref: affiliateRef,
            ...utmData,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.pix_qr_code && data?.pix_copy_paste) {
          setPixData({
            qrCode: data.pix_qr_code,
            copyPaste: data.pix_copy_paste,
          });
          setAsaasPaymentId(data.asaas_payment_id || null);
          firePixelEvent(productPixels, "Purchase", total);
          toast({ title: "Pagamento gerado, finalize via PIX" });
        } else {
          throw new Error("QR Code PIX não disponível");
        }
      } else {
        // Card payment via Asaas
        const expiryParts = form.cardExpiry.split("/");
        const expiryMonth = expiryParts[0] || "";
        const expiryYear = expiryParts[1] ? `20${expiryParts[1]}` : "";

        const { data, error } = await supabase.functions.invoke("create-card-payment", {
          body: {
            product_id: id,
            buyer_name: form.name,
            buyer_email: form.email,
            buyer_cpf: form.cpf,
            buyer_phone: form.phone,
            buyer_postal_code: form.cep.replace(/\D/g, ""),
            card_number: form.cardNumber,
            card_holder_name: form.cardHolder || form.name,
            card_expiry_month: expiryMonth,
            card_expiry_year: expiryYear,
            card_cvv: form.cardCvv,
            installments: form.installments,
            amount: total,
            affiliate_ref: affiliateRef,
            ...utmData,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.status === "CONFIRMED") {
          setCardStatus("approved");
          setPurchaseResult(data);
          firePixelEvent(productPixels, "Purchase", total);
        } else if (data?.status === "PENDING" || data?.status === "RECEIVED_IN_CASH") {
          setCardStatus("pending");
          setAsaasPaymentId(data.payment_id || null);
          toast({ title: "Pagamento em análise", description: "Aguarde a confirmação." });
        } else {
          setCardStatus("declined");
          toast({ title: "Pagamento recusado", description: "Verifique os dados do cartão e tente novamente.", variant: "destructive" });
        }
      }
    } catch (err: any) {
      setCardStatus("declined");
      toast({ title: "Erro no pagamento", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  // ── Upsell/Downsell Screen ──
  const activeFunnelStep = funnelSteps[currentFunnelStep];
  const showFunnel = purchaseResult && funnelSteps.length > 0 && currentFunnelStep < funnelSteps.length;

  if (showFunnel && activeFunnelStep) {
    const offerProduct = activeFunnelStep.offer_product;
    const originalPrice = offerProduct?.price || 0;
    const discountedPrice = originalPrice * (1 - (activeFunnelStep.discount_percentage || 0) / 100);
    const isUpsell = activeFunnelStep.step_type === "upsell";

    const handleAcceptOffer = () => {
      setFunnelAccepted((prev) => new Set(prev).add(activeFunnelStep.id));
      toast({ title: "Oferta aceita! 🎉", description: `${offerProduct?.title} adicionado.` });
      setCurrentFunnelStep((s) => s + 1);
    };

    const handleDeclineOffer = () => {
      setCurrentFunnelStep((s) => s + 1);
    };

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${product?.checkout_theme === 'light' ? 'checkout-light' : 'checkout-dark'}`} style={{ background: "var(--ck-bg)", color: "var(--ck-fg)" }}>
        <motion.div
          key={activeFunnelStep.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-lg w-full rounded-3xl p-8 space-y-6 relative overflow-hidden"
          style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}
        >
          {/* Badge */}
          <div className="flex justify-center">
            <span
              className="text-xs font-black uppercase tracking-wider px-4 py-1.5 rounded-full"
              style={{
                background: isUpsell ? "hsl(142,71%,45%,0.15)" : "hsl(25,95%,53%,0.15)",
                color: isUpsell ? "hsl(142,71%,45%)" : "hsl(25,95%,53%)",
              }}
            >
              {isUpsell ? "⬆️ Oferta Especial" : "⬇️ Última Chance"}
            </span>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black tracking-tight">
              {activeFunnelStep.title}
            </h1>
            {activeFunnelStep.description && (
              <p className="text-sm" style={{ color: "var(--ck-muted)" }}>
                {activeFunnelStep.description}
              </p>
            )}
          </div>

          {/* Product card */}
          {offerProduct && (
            <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--ck-bg)", border: "1px solid var(--ck-card-border)" }}>
              <div className="flex items-center gap-3">
                {offerProduct.cover_url && (
                  <img src={offerProduct.cover_url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{offerProduct.title}</p>
                  {offerProduct.description && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--ck-subtle)" }}>
                      {offerProduct.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                {activeFunnelStep.discount_percentage > 0 && (
                  <span className="text-sm line-through" style={{ color: "var(--ck-faint)" }}>
                    R$ {(originalPrice / 100).toFixed(2)}
                  </span>
                )}
                <span className="text-2xl font-black" style={{ color: "var(--ck-accent)" }}>
                  R$ {(discountedPrice / 100).toFixed(2)}
                </span>
                {activeFunnelStep.discount_percentage > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "hsl(0,84%,60%)", color: "white" }}>
                    {activeFunnelStep.discount_percentage}% OFF
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleAcceptOffer}
              className="w-full h-14 text-base font-bold gap-2 rounded-2xl shadow-lg transition-all hover:scale-[1.02]"
              style={{
                background: "hsl(142,71%,45%)",
                color: "white",
                boxShadow: "0 4px 20px hsl(142,71%,45%,0.3)",
              }}
            >
              Sim, eu quero! 🚀
            </Button>
            <button
              onClick={handleDeclineOffer}
              className="w-full text-center text-xs py-2 transition-colors"
              style={{ color: "var(--ck-dim)" }}
            >
              Não, obrigado. Continuar sem esta oferta →
            </button>
          </div>

          {/* Step indicator */}
          {funnelSteps.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {funnelSteps.map((_, idx) => (
                <div
                  key={idx}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: idx === currentFunnelStep ? 24 : 8,
                    background: idx === currentFunnelStep ? "var(--ck-accent)" : "var(--ck-card-border)",
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Success Screen ──
  if (purchaseResult) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${product?.checkout_theme === 'light' ? 'checkout-light' : 'checkout-dark'}`} style={{ background: "var(--ck-bg)", color: "var(--ck-fg)" }}>
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
                src="/leonardo-dicaprio-celebration.gif"
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
              Parabéns! Seu acesso a <strong style={{ color: "hsl(48,96%,53%)" }}>{purchaseResult.product_title}</strong> já está liberado.
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
                R$ {(purchaseResult.amount / 100).toFixed(2)}
              </span>
            </div>
            <Separator className="opacity-20" />
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: "var(--ck-subtle)" }}>ID da venda</span>
              <span className="font-mono text-xs px-2 py-1 rounded-lg" style={{ background: "var(--ck-card)", color: "var(--ck-muted)" }}>
                {purchaseResult.sale_id?.slice(0, 12)}
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-3 relative z-10"
          >
            {purchaseResult.file_url && (
              <Button
                className="w-full h-14 text-base font-bold gap-3 rounded-2xl shadow-lg transition-all hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, hsl(48,96%,53%), hsl(38,92%,45%))",
                  color: "hsl(0,0%,10%)",
                  boxShadow: "0 4px 20px hsl(48,96%,53%,0.3)",
                }}
                onClick={() => window.open(purchaseResult.file_url, "_blank")}
              >
                <ArrowDownToLine className="h-5 w-5" /> Baixar Produto
              </Button>
            )}
            {purchaseResult.product_type === "lms" && (
              <Button
                className="w-full h-14 text-base font-bold gap-3 rounded-2xl shadow-lg transition-all hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, hsl(48,96%,53%), hsl(38,92%,45%))",
                  color: "hsl(0,0%,10%)",
                  boxShadow: "0 4px 20px hsl(48,96%,53%,0.3)",
                }}
                onClick={() => toast({ title: "Acesse com seu email", description: "Faça login para acessar a área de membros." })}
              >
                Acessar Área de Membros
              </Button>
            )}
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

  if (loading) {
    return (
      <div className="min-h-screen checkout-dark flex items-center justify-center" style={{ background: "var(--ck-bg)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen checkout-dark flex items-center justify-center" style={{ background: "var(--ck-bg)" }}>
        <p style={{ color: "var(--ck-muted)" }}>Produto não encontrado.</p>
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

  const colorThemeClass = `checkout-theme-${(product as any)?.checkout_color_theme || 'classic'}`;

  return (
    <div className={`min-h-screen ${product.checkout_theme === 'light' ? 'checkout-light' : 'checkout-dark'} ${colorThemeClass}`} style={{ background: "var(--ck-bg)", color: "var(--ck-fg)" }}>
      {/* Social Proof Notifications */}
      <SocialProofNotification
        enabled={(product as any)?.checkout_social_proof || false}
        interval={(product as any)?.checkout_social_proof_interval || 30}
        productName={product.title}
      />
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
        <div className="py-2.5 text-center text-sm font-bold tracking-wide" style={{ background: "var(--ck-accent)", color: "var(--ck-accent-fg)" }}>
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
            <div className="rounded-xl p-5" style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}>
              <div className="flex items-start gap-4">
                {product.cover_url && (
                  <img src={product.cover_url} alt={product.title} className="h-16 w-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-lg">{product.title}</h2>
                  <p className="text-primary text-lg font-bold mt-1">
                    R$ {(product.price / 100).toFixed(2)}
                    <span className="text-xs font-normal ml-1" style={{ color: "var(--ck-subtle)" }}>cash</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Informações de Contato
              </h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs" style={{ color: "var(--ck-label)" }}>Nome completo</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ck-faint)" }} />
                    <Input
                      placeholder="Preencha seu nome completo"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      className="pl-10 border-0 h-11"
                      style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs" style={{ color: "var(--ck-label)" }}>Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ck-faint)" }} />
                    <Input
                      type="email"
                      placeholder="name@email.com"
                      value={form.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      className="pl-10 border-0 h-11"
                      style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs" style={{ color: "var(--ck-label)" }}>CPF / CNPJ</Label>
                    <div className="relative mt-1">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ck-faint)" }} />
                      <Input
                        placeholder="000.000.000-00"
                        value={form.cpf}
                        onChange={(e) => updateForm("cpf", formatCPF(e.target.value))}
                        className="pl-10 border-0 h-11"
                        style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: "var(--ck-label)" }}>Celular</Label>
                    <div className="flex gap-1.5 mt-1">
                      <div className="flex items-center gap-1 rounded-md px-3 text-xs shrink-0 h-11" style={{ background: "var(--ck-input)", color: "var(--ck-subtle)" }}>
                        🇧🇷 +55
                      </div>
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ck-faint)" }} />
                        <Input
                          placeholder="(00) 00000-0000"
                          value={form.phone}
                          onChange={(e) => updateForm("phone", formatPhone(e.target.value))}
                          className="pl-10 border-0 h-11"
                          style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}>
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
                      background: paymentMethod === method ? "hsl(142, 71%, 45%)" : "var(--ck-method-inactive)",
                      color: paymentMethod === method ? "white" : "var(--ck-method-inactive-fg)",
                      border: paymentMethod === method ? "1px solid hsl(142, 71%, 40%)" : "1px solid var(--ck-method-inactive-border)",
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
                  {/* Card Status Feedback */}
                  {cardStatus === "approved" && (
                    <div className="rounded-lg p-3 flex items-center gap-2 text-sm font-semibold" style={{ background: "hsl(142,71%,45%,0.15)", color: "hsl(142,71%,45%)", border: "1px solid hsl(142,71%,45%,0.3)" }}>
                      <CheckCircle2 className="h-4 w-4" /> Pagamento aprovado!
                    </div>
                  )}
                  {cardStatus === "declined" && (
                    <div className="rounded-lg p-3 flex items-center gap-2 text-sm font-semibold" style={{ background: "hsl(0,84%,60%,0.15)", color: "hsl(0,84%,60%)", border: "1px solid hsl(0,84%,60%,0.3)" }}>
                      <Lock className="h-4 w-4" /> Pagamento recusado. Verifique os dados.
                    </div>
                  )}
                  {cardStatus === "pending" && (
                    <div className="rounded-lg p-3 flex items-center gap-2 text-sm font-semibold" style={{ background: "hsl(48,96%,53%,0.15)", color: "hsl(48,96%,53%)", border: "1px solid hsl(48,96%,53%,0.3)" }}>
                      <Clock className="h-4 w-4" /> Pagamento em análise. Aguarde confirmação.
                    </div>
                  )}
                  <div>
                    <Label className="text-xs" style={{ color: "var(--ck-label)" }}>Número do cartão</Label>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={form.cardNumber}
                      onChange={(e) => updateForm("cardNumber", formatCardNumber(e.target.value))}
                      className="mt-1 border-0 h-11"
                      style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: "var(--ck-label)" }}>Nome no cartão</Label>
                    <Input
                      placeholder="Nome como aparece no cartão"
                      value={form.cardHolder}
                      onChange={(e) => updateForm("cardHolder", e.target.value)}
                      className="mt-1 border-0 h-11"
                      style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs" style={{ color: "var(--ck-label)" }}>Vencimento</Label>
                      <Input
                        placeholder="MM/AA"
                        value={form.cardExpiry}
                        onChange={(e) => updateForm("cardExpiry", formatExpiry(e.target.value))}
                        className="mt-1 border-0 h-11"
                        style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs" style={{ color: "var(--ck-label)" }}>CVV</Label>
                      <Input
                        placeholder="000"
                        value={form.cardCvv}
                        onChange={(e) => updateForm("cardCvv", e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="mt-1 border-0 h-11"
                        style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: "var(--ck-label)" }}>CEP</Label>
                    <Input
                      placeholder="00000-000"
                      value={form.cep}
                      onChange={(e) => updateForm("cep", formatCEP(e.target.value))}
                      className="mt-1 border-0 h-11"
                      style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: "var(--ck-label)" }}>Parcelas</Label>
                    <select
                      value={form.installments}
                      onChange={(e) => updateForm("installments", e.target.value)}
                      className="mt-1 flex h-11 w-full rounded-md px-3 py-2 text-sm border-0"
                      style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
                    >
                      {installmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {isCardDisabled && (
                    <div className="rounded-lg p-3 flex items-center gap-2 text-xs font-medium" style={{ background: "hsl(48,96%,53%,0.15)", color: "hsl(48,96%,53%)", border: "1px solid hsl(48,96%,53%,0.3)" }}>
                      <Clock className="h-3.5 w-3.5" /> Valor mínimo para cartão é R$ 5,00. Use PIX.
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ck-dim)" }}>
                    <Lock className="h-3 w-3" />
                    Seus dados de pagamento são criptografados e processados de forma segura.
                  </div>
                </motion.div>
              )}

              {paymentMethod === "pix" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-lg p-6 text-center space-y-4"
                  style={{ background: "var(--ck-input)" }}
                >
                  {pixData ? (
                    <>
                      <p className="text-sm font-bold" style={{ color: "hsl(142, 71%, 45%)" }}>
                        Pagamento gerado, finalize via PIX
                      </p>
                      <div className="flex justify-center">
                        <img
                          src={`data:image/png;base64,${pixData.qrCode}`}
                          alt="QR Code PIX"
                          className="w-48 h-48 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium" style={{ color: "var(--ck-subtle)" }}>
                          Ou copie o código PIX:
                        </p>
                        <div className="flex gap-2 items-center">
                          <input
                            readOnly
                            value={pixData.copyPaste}
                            className="flex-1 text-xs rounded-md px-3 py-2 truncate border-0"
                            style={{ background: "var(--ck-card)", color: "var(--ck-input-fg)" }}
                          />
                          <Button
                            size="sm"
                            className="shrink-0 bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,38%)] text-white"
                            onClick={() => {
                              navigator.clipboard.writeText(pixData.copyPaste);
                              toast({ title: "Código PIX copiado!" });
                            }}
                          >
                            <Copy className="h-4 w-4 mr-1" /> Copiar
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <QrCode className="h-12 w-12 mx-auto text-primary" />
                      <p className="text-sm font-medium">Pagamento via PIX</p>
                      <p className="text-xs" style={{ color: "var(--ck-subtle)" }}>
                        Ao clicar em "Pagar", um QR Code será gerado para pagamento instantâneo.
                      </p>
                    </>
                  )}
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
                        background: isSelected ? "hsl(48, 96%, 53%, 0.1)" : "var(--ck-card)",
                        border: isSelected ? "2px solid hsl(48, 96%, 53%)" : "2px solid var(--ck-card-border)",
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
                                <p className="text-xs mt-0.5" style={{ color: "var(--ck-subtle)" }}>{bump.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {bump.discount_percentage > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs line-through" style={{ color: "var(--ck-faint)" }}>
                                R$ {(bumpPrice / 100).toFixed(2)}
                              </span>
                              <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded" style={{ background: "hsl(0, 84%, 60%)", color: "hsl(0,0%,10%)" }}>
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
            <div className="rounded-xl p-5" style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}>
              <Label className="text-xs flex items-center gap-1.5 mb-2" style={{ color: "var(--ck-label)" }}>
                <Tag className="h-3.5 w-3.5" /> Cupom de desconto
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="CÓDIGO DO CUPOM"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="uppercase text-sm border-0 h-11"
                  style={{ background: "var(--ck-input)", color: "var(--ck-input-fg)" }}
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
              <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ck-subtle)" }}>
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
                      <span style={{ color: "var(--ck-label)" }}>{b.bump_product?.title || b.title}</span>
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

                <Separator style={{ background: "var(--ck-card-border)" }} />

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
                className="w-full h-14 text-base font-bold gap-2 rounded-xl bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,38%)] text-white border-0"
                size="lg"
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
                <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "var(--ck-dim)" }}>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Compra 100% segura e criptografada
                </div>
                <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "var(--ck-dim)" }}>
                  <Lock className="h-3.5 w-3.5" />
                  Dados protegidos com SSL
                </div>
              </div>

              {/* Testimonials */}
              {testimonials.length > 0 && (
                <div className="space-y-3 mt-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-center" style={{ color: "var(--ck-subtle)" }}>
                    O que dizem nossos alunos
                  </p>
                  {testimonials.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl p-4 space-y-2"
                      style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}
                    >
                      <div className="flex items-center gap-2">
                        {t.author_avatar_url ? (
                          <img src={t.author_avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "hsl(48, 96%, 53%, 0.2)", color: "hsl(48, 96%, 45%)" }}>
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
                      <p className="text-xs leading-relaxed" style={{ color: "var(--ck-muted)" }}>
                        {t.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {producer && (
                <p className="text-[0.6rem] text-center" style={{ color: "var(--ck-ghost)" }}>
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
