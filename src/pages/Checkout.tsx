import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Clock,
  Tag,
  Plus,
  CreditCard,
  Loader2,
  Zap,
  QrCode,
  Lock,
  CheckCircle2,
  Star,
} from "lucide-react";

type PaymentMethod = "card" | "pix";

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
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");

  // Form fields
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

  useEffect(() => {
    if (!id) return;
    const loadCheckout = async () => {
      const { data: prod } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (prod) {
        setProduct(prod);
        if (prod.checkout_timer_minutes && prod.checkout_timer_minutes > 0) {
          setTimeLeft(prod.checkout_timer_minutes * 60);
        }
        // Get producer name
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
      setLoading(false);
    };
    loadCheckout();
  }, [id]);

  // Pre-fill form with user data
  useEffect(() => {
    if (user?.email) {
      setForm((f) => ({ ...f, email: user.email || "" }));
    }
  }, [user]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return { min: m.toString().padStart(2, "0"), sec: sec.toString().padStart(2, "0") };
  };

  const updateForm = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const formatCPF = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const formatCardNumber = (v: string) => {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim();
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
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
      if (data.max_uses && data.uses >= data.max_uses) {
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
        const bumpPrice = bump.bump_product?.price || 0;
        const discount = bump.discount_percentage || 0;
        total += bumpPrice * (1 - discount / 100);
      }
    }
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === "percentage") {
        total = total * (1 - appliedCoupon.discount_value / 100);
      } else {
        total = Math.max(0, total - appliedCoupon.discount_value);
      }
    }
    return Math.round(total);
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!form.name || !form.email) {
      toast({ title: "Preencha seus dados", variant: "destructive" });
      return;
    }
    setProcessing(true);
    toast({ title: "Processando pagamento...", description: "Integração de pagamento em breve." });
    setTimeout(() => setProcessing(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Produto não encontrado.</p>
      </div>
    );
  }

  const total = calculateTotal();
  const time = formatTime(timeLeft);
  const installmentPrice = (total / 100 / 12).toFixed(2);

  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const val = (total / 100 / n).toFixed(2);
    return { value: String(n), label: `${n}x de R$ ${val}${n > 1 ? " *" : ""}` };
  });

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Timer bar */}
      {timeLeft > 0 && (
        <div className="bg-destructive text-destructive-foreground py-3">
          <div className="container max-w-5xl flex items-center justify-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="bg-background/20 rounded px-2 py-1 text-lg font-bold tabular-nums">
                  {time.min}
                </div>
                <span className="text-lg font-bold">:</span>
                <div className="bg-background/20 rounded px-2 py-1 text-lg font-bold tabular-nums">
                  {time.sec}
                </div>
              </div>
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium hidden sm:block">
              Você ainda tem tempo! Garanta sua oferta exclusiva agora
            </p>
          </div>
        </div>
      )}

      {/* Headline bar */}
      {product.checkout_headline && (
        <div className="bg-primary text-primary-foreground py-2 text-center text-sm font-bold">
          {product.checkout_headline}
        </div>
      )}

      {/* Banner */}
      {product.checkout_banner_url && (
        <div className="container max-w-5xl mt-4 px-4">
          <div className="rounded-xl overflow-hidden max-h-52">
            <img
              src={product.checkout_banner_url}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      <div className="container max-w-5xl py-6 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT: Form */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
            className="lg:col-span-3 space-y-5"
          >
            {/* Product info card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                {product.cover_url && (
                  <img
                    src={product.cover_url}
                    alt={product.title}
                    className="h-20 w-20 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-base">{product.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-lg font-bold text-primary">
                      12x de R$ {installmentPrice}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ou R$ {(total / 100).toFixed(2)} à vista
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seus dados */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                Seus dados
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Nome completo</Label>
                  <Input
                    placeholder="Preencha seu nome"
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    placeholder="Preencha seu email"
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CPF/CNPJ</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => updateForm("cpf", formatCPF(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Celular</Label>
                  <div className="flex gap-1.5 mt-1">
                    <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground shrink-0">
                      🇧🇷 +55
                    </div>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={form.phone}
                      onChange={(e) => updateForm("phone", formatPhone(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pagamento */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                Pagamento
              </h3>

              {/* Payment method tabs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 px-4 transition-all ${
                    paymentMethod === "pix"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <QrCode className="h-5 w-5" strokeWidth={1.5} />
                  <span className="text-sm font-medium">PIX</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 px-4 transition-all ${
                    paymentMethod === "card"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <CreditCard className="h-5 w-5" strokeWidth={1.5} />
                  <span className="text-sm font-medium">Cartão de Crédito</span>
                </button>
              </div>

              {paymentMethod === "card" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Número do cartão</Label>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={form.cardNumber}
                      onChange={(e) => updateForm("cardNumber", formatCardNumber(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Vencimento</Label>
                      <Input
                        placeholder="MM/AA"
                        value={form.cardExpiry}
                        onChange={(e) => updateForm("cardExpiry", formatExpiry(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CVV</Label>
                      <Input
                        placeholder="000"
                        value={form.cardCvv}
                        onChange={(e) => updateForm("cardCvv", e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Parcelas</Label>
                      <select
                        value={form.installments}
                        onChange={(e) => updateForm("installments", e.target.value)}
                        className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {installmentOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome do titular</Label>
                    <Input
                      placeholder="Nome no cartão"
                      value={form.cardHolder}
                      onChange={(e) => updateForm("cardHolder", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Os seus dados de pagamento são criptografados e processados de forma segura.
                  </div>
                </div>
              )}

              {paymentMethod === "pix" && (
                <div className="rounded-lg bg-muted/30 p-4 text-center space-y-2">
                  <QrCode className="h-10 w-10 mx-auto text-primary" />
                  <p className="text-sm font-medium">Pagamento via PIX</p>
                  <p className="text-xs text-muted-foreground">
                    Ao clicar em "Pagar", um QR Code será gerado para pagamento instantâneo.
                  </p>
                </div>
              )}
            </div>

            {/* Order Bumps */}
            {orderBumps.length > 0 && (
              <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 space-y-3">
                <h3 className="text-sm font-bold text-center">
                  ✅ Oferta limitada — Toque para adicionar ↓
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
                      className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-card"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox checked={isSelected} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{bump.title}</p>
                          {bump.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {bump.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {bump.discount_percentage > 0 && (
                            <span className="text-xs text-muted-foreground line-through block">
                              R$ {(bumpPrice / 100).toFixed(2)}
                            </span>
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
            <div className="rounded-xl border border-border bg-card p-5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <Tag className="h-3.5 w-3.5" /> Aplicar Cupom
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="CÓDIGO DO CUPOM"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="uppercase text-sm"
                  disabled={!!appliedCoupon}
                />
                {appliedCoupon ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponCode("");
                    }}
                  >
                    Remover
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={applyCoupon}>
                    Aplicar
                  </Button>
                )}
              </div>
              {appliedCoupon && (
                <p className="text-xs text-primary mt-2 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Cupom aplicado: {appliedCoupon.discount_type === "percentage"
                    ? `${appliedCoupon.discount_value}% off`
                    : `R$ ${(appliedCoupon.discount_value / 100).toFixed(2)} off`}
                </p>
              )}
            </div>
          </motion.div>

          {/* RIGHT: Summary */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.2, 0, 0, 1] }}
            className="lg:col-span-2"
          >
            <div className="sticky top-6 space-y-4">
              {/* Compra segura header */}
              <div className="rounded-xl bg-primary text-primary-foreground p-4 text-center">
                <h3 className="font-bold text-base flex items-center justify-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Compra segura
                </h3>
              </div>

              {/* Product mini card */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-start gap-3">
                  {product.cover_url && (
                    <img
                      src={product.cover_url}
                      alt={product.title}
                      className="h-14 w-14 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div>
                    <h4 className="text-sm font-bold">{product.title}</h4>
                    {producer && (
                      <p className="text-[0.65rem] text-muted-foreground mt-0.5">
                        Vendedor: @{producer.toLowerCase().replace(/\s+/g, "")}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Resumo do pedido */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Resumo do pedido
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{product.title}</span>
                    <span>R$ {(product.price / 100).toFixed(2)}</span>
                  </div>
                  {Array.from(selectedBumps).map((bId) => {
                    const b = orderBumps.find((ob) => ob.id === bId);
                    if (!b) return null;
                    const bp = b.bump_product?.price || 0;
                    const dp = bp * (1 - (b.discount_percentage || 0) / 100);
                    return (
                      <div key={bId} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{b.title}</span>
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

                  <Separator />

                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">
                      {paymentMethod === "card" && parseInt(form.installments) > 1
                        ? `Em até ${form.installments}x de`
                        : ""}
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      R${" "}
                      {paymentMethod === "card" && parseInt(form.installments) > 1
                        ? (total / 100 / parseInt(form.installments)).toFixed(2)
                        : (total / 100).toFixed(2)}
                    </p>
                    {paymentMethod === "card" && parseInt(form.installments) > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ou R$ {(total / 100).toFixed(2)} à vista
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Buy Button */}
              <Button
                onClick={handlePurchase}
                disabled={processing}
                className="w-full h-14 text-base font-bold gap-2 rounded-xl"
                size="lg"
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : paymentMethod === "pix" ? (
                  <>
                    <QrCode className="h-5 w-5" />
                    Pagar com PIX
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    Pagar com Cartão de Crédito
                  </>
                )}
              </Button>

              {/* Trust info */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Ambiente seguro e criptografado
                </div>
                {producer && (
                  <p className="text-[0.6rem] text-muted-foreground">
                    Processando pagamento para o vendedor @{producer.toLowerCase().replace(/\s+/g, "")}
                  </p>
                )}
                <p className="text-[0.6rem] text-muted-foreground">
                  * Parcelamento com acréscimo
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
