import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCheckoutPixels, firePixelEvent } from "@/components/checkout/CheckoutPixels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
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

// Lazy load heavy components
const SocialProofNotification = lazy(() => import("@/components/checkout/SocialProofNotification").then(m => ({ default: m.SocialProofNotification })));

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
        <div className={`${c.fullWidth ? "w-full" : "max-w-md mx-auto"} rounded-xl overflow-hidden`}>
          <img src={c.url} alt={c.alt || ""} className="w-full h-auto object-contain rounded-xl" />
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
    installments: "12",
    cep: "",
  });

  const [checkoutBlocks, setCheckoutBlocks] = useState<any[]>([]);
  const [productPixels, setProductPixels] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const loadCheckout = async () => {
      // ── PARALLEL: Fire all queries at once instead of sequential waterfall ──
      const [
        { data: prod },
        { data: bumps },
        { data: fSteps },
        { data: testis },
        { data: blocks },
        { data: pxs },
      ] = await Promise.all([
        supabase.from("products").select("*").eq("id", id).single(),
        supabase.from("order_bumps").select("*, bump_product:bump_product_id(*)").eq("product_id", id).eq("is_active", true),
        supabase.from("funnel_steps").select("*, offer_product:offer_product_id(id, title, price, cover_url, description, file_url, type)").eq("product_id", id).eq("is_active", true).order("position", { ascending: true }),
        supabase.from("checkout_testimonials").select("*").eq("product_id", id).eq("is_active", true).order("position", { ascending: true }),
        supabase.from("checkout_blocks").select("*").eq("product_id", id).eq("is_active", true).order("position", { ascending: true }),
        supabase.from("product_pixels").select("*").eq("product_id", id).eq("is_active", true),
      ]);

      if (prod) {
        setProduct(prod);
        if (prod.checkout_timer_minutes && prod.checkout_timer_minutes > 0) {
          setTimeLeft(prod.checkout_timer_minutes * 60);
        }
        // Producer name fetch — non-blocking, runs in background
        supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", prod.producer_id)
          .maybeSingle()
          .then(({ data: profile }) => {
            setProducer(profile?.display_name || "");
          });
      }

      if (bumps) setOrderBumps(bumps);
      if (fSteps) setFunnelSteps(fSteps);
      if (testis) setTestimonials(testis);
      if (blocks) setCheckoutBlocks(blocks);
      if (pxs) setProductPixels(pxs);

      // Track affiliate click — non-blocking
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

  // Pre-fill email from Supabase session (non-blocking)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data?.session?.user?.email;
      if (email) setForm((f) => ({ ...f, email }));
    });
  }, []);

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
          firePixelEvent(productPixels, "Purchase", total, "BRL", data.asaas_payment_id || undefined);
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
          firePixelEvent(productPixels, "Purchase", total, "BRL", data.payment_id || undefined);
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
        <div
          key={activeFunnelStep.id}
          className="max-w-lg w-full rounded-3xl p-8 space-y-6 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}
        >
          {/* Badge */}
          <div className="flex justify-center">
            <span
              className="text-xs font-black uppercase tracking-wider px-4 py-1.5 rounded-full"
              style={{
                background: isUpsell ? "hsl(142,71%,45%,0.15)" : "hsl(25,95%,53%,0.15)",
                color: isUpsell ? "hsl(145,63%,32%)" : "hsl(25,95%,53%)",
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
                  <img src={offerProduct.cover_url} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover shrink-0" />
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
                background: "hsl(145,63%,32%)",
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
        </div>
      </div>
    );
  }

  // ── Success Screen ──
  if (purchaseResult) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${product?.checkout_theme === 'light' ? 'checkout-light' : 'checkout-dark'}`} style={{ background: "var(--ck-bg)", color: "var(--ck-fg)" }}>
        <div
          
          
          
          className="max-w-lg w-full rounded-3xl p-8 text-center space-y-6 relative overflow-hidden"
          style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}
        >
          {/* Confetti-like decorative dots */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-pulse"
                style={{
                  width: Math.random() * 8 + 4,
                  height: Math.random() * 8 + 4,
                  background: `hsl(${48 + Math.random() * 20}, 96%, ${45 + Math.random() * 15}%)`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  opacity: 0.15 + Math.random() * 0.2,
                }}
              />
            ))}
          </div>

          {/* Leonardo DiCaprio celebration GIF */}
          <div
            
            
            
            className="flex justify-center relative z-10"
          >
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: "2px solid hsl(48,96%,53%,0.3)" }}>
              <img
                src="/leonardo-dicaprio-celebration.gif"
                alt="Celebração"
                className="w-48 h-auto"
              />
            </div>
          </div>

          {/* Success badge */}
          <div
            
            
            
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
          </div>

          <div
            
            
            
            className="space-y-2 relative z-10"
          >
            <h1 className="text-3xl font-black tracking-tight">
              Compra Confirmada! 🎉
            </h1>
            <p className="text-base" style={{ color: "var(--ck-muted)" }}>
              Parabéns! Seu acesso a <strong style={{ color: "hsl(48,96%,53%)" }}>{purchaseResult.product_title}</strong> já está liberado.
            </p>
          </div>

          <div
            
            
            
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
          </div>

          <div
            
            
            
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
          </div>

          <p
            
            
            
            className="text-xs relative z-10"
            style={{ color: "var(--ck-subtle)" }}
          >
            Um email de confirmação foi enviado para você 📧
          </p>
        </div>
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

  const SERVICE_FEE = 99; // R$ 0.99 in centavos

  const installmentOptionsAsc = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    if (n === 1) {
      return { value: "1", label: `1x de R$ ${(total / 100).toFixed(2)}`, totalWithFees: total };
    }
    const fixedFee = SERVICE_FEE;
    const baseRate = n <= 6 ? 0.0349 : 0.0399;
    const baseFixed = 49;
    const monthlyInterest = 0.016;
    
    const baseCost = Math.round(total * baseRate + baseFixed);
    const interestCost = Math.round(total * monthlyInterest * (n - 1));
    const totalWithFees = total + baseCost + interestCost + (fixedFee * n);
    const installmentValue = (totalWithFees / n / 100).toFixed(2);
    
    return {
      value: String(n),
      label: `${n}x de R$ ${installmentValue}`,
      totalWithFees,
    };
  });
  // Reverse so 12x appears first in selector
  const installmentOptions = [...installmentOptionsAsc].reverse();

  // Get the max installment for display at top
  const maxInstallment = installmentOptionsAsc[installmentOptionsAsc.length - 1];

  const colorThemeClass = `checkout-theme-${(product as any)?.checkout_color_theme || 'classic'}`;

  return (
    <div className={`min-h-screen ${product.checkout_theme === 'light' ? 'checkout-light' : 'checkout-dark'} ${colorThemeClass}`} style={{ background: "var(--ck-bg)", color: "var(--ck-fg)" }} role="main">
      {/* Social Proof Notifications */}
      <Suspense fallback={null}>
        <SocialProofNotification
          enabled={(product as any)?.checkout_social_proof || false}
          interval={(product as any)?.checkout_social_proof_interval || 30}
          productName={product.title}
        />
      </Suspense>
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
          <div
            className="lg:col-span-3 space-y-5"
          >
            {/* Checkout banner image - Cakto style */}
            {product.checkout_banner_url && (
              <div className="rounded-xl overflow-hidden">
                <img src={product.checkout_banner_url} alt={product.title} fetchPriority="high" className="w-full h-auto object-contain rounded-xl" />
              </div>
            )}

            {/* Product Info Card - Cakto style with installment highlight */}
            <div className="rounded-xl p-5" style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}>
              <h2 className="font-bold text-xl" style={{ color: "var(--ck-fg)" }}>{product.title}</h2>
              <p className="font-bold mt-1" style={{ color: "var(--ck-accent)" }}>
                <span className="text-lg">{maxInstallment.label}</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ck-subtle)" }}>
                ou R$ {(total / 100).toFixed(2)} à vista
              </p>
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
                      background: paymentMethod === method ? "hsl(145, 63%, 32%)" : "var(--ck-method-inactive)",
                      color: paymentMethod === method ? "white" : "var(--ck-method-inactive-fg)",
                      border: paymentMethod === method ? "1px solid hsl(145, 63%, 28%)" : "1px solid var(--ck-method-inactive-border)",
                    }}
                  >
                    {method === "pix" ? <QrCode className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    {method === "pix" ? "Pix" : "Cartão de Crédito"}
                  </button>
                ))}
              </div>

              {paymentMethod === "card" && (
                <div
                  
                  
                  className="space-y-3"
                >
                  {/* Card Status Feedback */}
                  {cardStatus === "approved" && (
                    <div className="rounded-lg p-3 flex items-center gap-2 text-sm font-semibold" style={{ background: "hsl(142,71%,45%,0.15)", color: "hsl(145,63%,32%)", border: "1px solid hsl(142,71%,45%,0.3)" }}>
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
                </div>
              )}

              {paymentMethod === "pix" && (
                <div
                  
                  
                  className="rounded-lg p-6 text-center space-y-4"
                  style={{ background: "var(--ck-input)" }}
                >
                  {pixData ? (
                    <>
                      <p className="text-sm font-bold" style={{ color: "hsl(145, 63%, 32%)" }}>
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
                            className="shrink-0 bg-[hsl(145,63%,32%)] hover:bg-[hsl(145,63%,26%)] text-white"
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
                </div>
              )}
            </div>

            {/* Order Bumps - Cakto style */}
            {orderBumps.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 justify-center">
                  <span className="text-sm" style={{ color: "var(--ck-fg)" }}>⚡</span>
                  <h3 className="text-sm font-bold" style={{ color: "var(--ck-fg)" }}>
                    Oferta limitada
                  </h3>
                </div>
                {orderBumps.map((bump) => {
                  const bumpPrice = bump.bump_product?.price || 0;
                  const discountedPrice = bumpPrice * (1 - (bump.discount_percentage || 0) / 100);
                  const isSelected = selectedBumps.has(bump.id);

                  return (
                    <div
                      key={bump.id}
                      
                      className="rounded-xl overflow-hidden cursor-pointer transition-all"
                      style={{
                        border: isSelected ? "2px solid var(--ck-accent)" : "2px solid var(--ck-card-border)",
                      }}
                      onClick={() => toggleBump(bump.id)}
                    >
                      {/* Header bar */}
                      <div
                        className="px-4 py-2.5 flex items-center justify-between"
                        style={{ background: "var(--ck-accent)", color: "var(--ck-accent-fg)" }}
                      >
                        <p className="text-xs font-black uppercase tracking-wider">
                          {bump.title || "9 A CADA 10 COMPRAM JUNTO..."}
                        </p>
                        <Checkbox
                          checked={isSelected}
                          className="border-current data-[state=checked]:bg-white data-[state=checked]:text-black"
                        />
                      </div>
                      {/* Body */}
                      <div className="p-4" style={{ background: "var(--ck-card)" }}>
                        <div className="flex items-start gap-3">
                          {bump.bump_product?.cover_url && (
                            <img src={bump.bump_product.cover_url} alt="" loading="lazy" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: "var(--ck-fg)" }}>
                              {bump.bump_product?.title}
                            </p>
                            {bump.description && (
                              <p className="text-xs mt-1" style={{ color: "var(--ck-subtle)" }}>{bump.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {bump.discount_percentage > 0 && (
                                <span className="text-xs line-through" style={{ color: "var(--ck-faint)" }}>
                                  R$ {(bumpPrice / 100).toFixed(2)}
                                </span>
                              )}
                              <span className="text-sm font-bold" style={{ color: "var(--ck-accent)" }}>
                                R$ {(discountedPrice / 100).toFixed(2)}
                              </span>
                              {bump.discount_percentage > 0 && (
                                <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded" style={{ background: "hsl(0, 84%, 60%)", color: "white" }}>
                                  {bump.discount_percentage}% OFF
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Coupon — only if producer enabled */}
            {(product as any)?.coupons_enabled && (
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
            )}
          </div>

          {/* RIGHT COLUMN - Cakto style sidebar */}
          <div
            className="lg:col-span-2"
          >
            <div className="sticky top-6 space-y-4">

              {/* Summary card */}
              <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--ck-card)", border: "1px solid var(--ck-card-border)" }}>
                {/* Product name + help */}
                <div>
                  <h4 className="font-bold text-base" style={{ color: "var(--ck-fg)" }}>{product.title}</h4>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ck-subtle)" }}>Precisa de ajuda?</p>
                  {producer && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--ck-accent)" }}>
                      Veja o contato do vendedor
                    </p>
                  )}
                </div>

                {/* Resumo do pedido */}
                <div className="flex justify-between text-sm" style={{ color: "var(--ck-label)" }}>
                  <span className="truncate mr-2">{product.title}</span>
                  <span className="shrink-0">R$ {(product.price / 100).toFixed(2)}</span>
                </div>

                {/* Order bumps in summary */}
                {Array.from(selectedBumps).map((bId) => {
                  const b = orderBumps.find((ob) => ob.id === bId);
                  if (!b) return null;
                  const bp = b.bump_product?.price || 0;
                  const dp = bp * (1 - (b.discount_percentage || 0) / 100);
                  return (
                    <div key={bId} className="flex justify-between text-xs" style={{ color: "var(--ck-label)" }}>
                      <span className="truncate mr-2">{b.bump_product?.title || b.title}</span>
                      <span className="shrink-0">+ R$ {(dp / 100).toFixed(2)}</span>
                    </div>
                  );
                })}

                {appliedCoupon && (
                  <div className="flex justify-between text-xs" style={{ color: "var(--ck-accent)" }}>
                    <span>Desconto</span>
                    <span>
                      -{appliedCoupon.discount_type === "percentage"
                        ? `${appliedCoupon.discount_value}%`
                        : `R$ ${(appliedCoupon.discount_value / 100).toFixed(2)}`}
                    </span>
                  </div>
                )}

                {/* Taxa de serviço */}
                {paymentMethod === "card" && (
                  <div className="flex justify-between text-xs" style={{ color: "var(--ck-label)" }}>
                    <span>Taxa de serviço</span>
                    <span>R$ 0,99</span>
                  </div>
                )}

                <Separator className="my-1" style={{ background: "var(--ck-card-border)", borderStyle: "dashed" }} />

                {/* Total */}
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--ck-fg)" }}>Total</p>
                  {paymentMethod === "card" && parseInt(form.installments) > 1 ? (
                    <>
                      <p className="text-xl font-black mt-0.5" style={{ color: "var(--ck-accent)" }}>
                        {installmentOptionsAsc.find(o => o.value === form.installments)?.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ck-subtle)" }}>
                        ou R$ {(total / 100).toFixed(2)} à vista
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-black mt-0.5" style={{ color: "var(--ck-accent)" }}>
                        R$ {(total / 100).toFixed(2)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ck-subtle)" }}>
                        à vista
                      </p>
                    </>
                  )}
                </div>

                <Separator className="my-1" style={{ background: "var(--ck-card-border)", borderStyle: "dashed" }} />

                {/* Logo + processing info */}
                <div className="text-center space-y-1.5">
                  <img
                    src="/logo-vitrapay-horizontal.png"
                    alt="VitraPay"
                    className="h-6 mx-auto"
                  />
                  <p className="text-[0.6rem]" style={{ color: "var(--ck-ghost)" }}>
                    VitraPay está processando este pagamento
                    {producer && <><br />para o vendedor <strong>{producer}</strong></>}
                  </p>
                  <p className="text-[0.6rem]" style={{ color: "var(--ck-ghost)" }}>
                    Este site é protegido e seus dados estão seguros.
                  </p>
                  <p className="text-[0.6rem]" style={{ color: "var(--ck-ghost)" }}>
                    * Parcelamento com acréscimo
                  </p>
                  <p className="text-[0.6rem] mt-2" style={{ color: "var(--ck-ghost)" }}>
                    Ao continuar, você concorda com os{" "}
                    <a href="/purchase-terms" target="_blank" className="underline" style={{ color: "var(--ck-accent)" }}>
                      Termos de Compra
                    </a>
                    {" "}e{" "}
                    <a href="/privacy" target="_blank" className="underline" style={{ color: "var(--ck-accent)" }}>
                      Política de Privacidade
                    </a>
                  </p>
                </div>
              </div>

              {/* Buy Button - ABOVE "Compra segura" */}
              <Button
                onClick={handlePurchase}
                disabled={processing}
                className="w-full h-14 text-base font-bold gap-2 rounded-xl bg-[hsl(145,63%,32%)] hover:bg-[hsl(145,63%,26%)] text-white border-0"
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

              {/* Compra Segura - BELOW buy button */}
              <div
                className="py-3 px-5 text-center font-bold text-sm tracking-wide rounded-xl"
                style={{ background: "var(--ck-accent)", color: "var(--ck-accent-fg)" }}
              >
                <ShieldCheck className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
                Compra segura
              </div>

              {/* Processing warning */}
              {processing && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium animate-pulse" style={{ background: "hsl(48,96%,53%,0.15)", color: "hsl(48,80%,35%)", border: "1px solid hsl(48,96%,53%,0.3)" }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  ⚠️ Não saia desta página até a confirmação do pagamento
                </div>
              )}

              {/* PIX waiting warning */}
              {pixData && !purchaseResult && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium" style={{ background: "hsl(200,90%,50%,0.1)", color: "hsl(200,80%,35%)", border: "1px solid hsl(200,90%,50%,0.25)" }}>
                  <Clock className="h-4 w-4" />
                  Aguarde nesta página — a confirmação do PIX é automática
                </div>
              )}

              {/* Trust badges */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "var(--ck-dim)" }}>
                  <Lock className="h-3.5 w-3.5" />
                  Compra 100% segura e criptografada
                </div>
              </div>

              {/* Sidebar vertical banner */}
              {(product as any).checkout_sidebar_banner_url && (
                <div className="rounded-xl overflow-hidden">
                  <img src={(product as any).checkout_sidebar_banner_url} alt="Banner" loading="lazy" className="w-full h-auto object-contain rounded-xl" />
                </div>
              )}

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
                          <img src={t.author_avatar_url} alt="" loading="lazy" className="h-8 w-8 rounded-full object-cover" />
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
