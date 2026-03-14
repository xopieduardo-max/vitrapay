import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ShieldCheck, Clock, Tag, ChevronRight, Plus, CreditCard, Loader2, Zap,
} from "lucide-react";

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [product, setProduct] = useState<any>(null);
  const [orderBumps, setOrderBumps] = useState<any[]>([]);
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

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

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
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

    // Add order bumps
    for (const bump of orderBumps) {
      if (selectedBumps.has(bump.id)) {
        const bumpPrice = bump.bump_product?.price || 0;
        const discount = bump.discount_percentage || 0;
        total += bumpPrice * (1 - discount / 100);
      }
    }

    // Apply coupon
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
    setProcessing(true);
    // TODO: integrate real payment (Stripe/MercadoPago)
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

  return (
    <div className="min-h-screen bg-background">
      {/* Timer bar */}
      {timeLeft > 0 && (
        <div className="bg-destructive text-destructive-foreground py-2 text-center text-sm font-medium">
          <Clock className="inline h-4 w-4 mr-1" />
          Oferta expira em <span className="font-bold">{formatTime(timeLeft)}</span>
        </div>
      )}

      {/* Banner */}
      {product.checkout_banner_url && (
        <div className="w-full max-h-48 overflow-hidden">
          <img
            src={product.checkout_banner_url}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="container max-w-2xl py-8 px-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
          className="space-y-6"
        >
          {/* Headline */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-title">
              {product.checkout_headline || "Finalizar Compra"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Pagamento seguro e criptografado
            </p>
          </div>

          {/* Product summary */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-4">
              {product.cover_url && (
                <img
                  src={product.cover_url}
                  alt={product.title}
                  className="h-20 w-20 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm">{product.title}</h2>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {product.description}
                </p>
                <Badge variant="secondary" className="mt-2 text-[0.6rem]">
                  {product.type === "lms" ? "Área de Membros" : "Download"}
                </Badge>
              </div>
              <span className="text-lg font-bold text-primary whitespace-nowrap">
                R$ {(product.price / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Order Bumps */}
          {orderBumps.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-label text-muted-foreground">
                Adicione à sua compra
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
                    className={`rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <Plus className="h-3 w-3 text-primary-foreground rotate-0" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{bump.title}</p>
                        {bump.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{bump.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {bump.discount_percentage > 0 && (
                          <span className="text-xs text-muted-foreground line-through mr-1">
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
          <div className="rounded-lg border border-border bg-card p-4">
            <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              <Tag className="h-3 w-3" /> Cupom de desconto
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="CÓDIGO"
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
              <p className="text-xs text-primary mt-2 font-medium">
                ✓ Cupom aplicado: {appliedCoupon.discount_type === "percentage"
                  ? `${appliedCoupon.discount_value}% off`
                  : `R$ ${(appliedCoupon.discount_value / 100).toFixed(2)} off`}
              </p>
            )}
          </div>

          <Separator />

          {/* Total */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {(product.price / 100).toFixed(2)}</span>
            </div>
            {selectedBumps.size > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Adicionais</span>
                <span>
                  R$ {((total - product.price + (appliedCoupon
                    ? appliedCoupon.discount_type === "percentage"
                      ? total / (1 - appliedCoupon.discount_value / 100) - product.price
                      : total + appliedCoupon.discount_value - product.price
                    : 0)) / 100).toFixed(2)}
                </span>
              </div>
            )}
            {appliedCoupon && (
              <div className="flex justify-between text-sm text-primary">
                <span>Desconto</span>
                <span>
                  - R$ {((product.price + Array.from(selectedBumps).reduce((acc, bId) => {
                    const b = orderBumps.find(ob => ob.id === bId);
                    if (!b) return acc;
                    const bp = b.bump_product?.price || 0;
                    return acc + bp * (1 - (b.discount_percentage || 0) / 100);
                  }, 0) - total) / 100).toFixed(2)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold text-primary">
                R$ {(total / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment button */}
          <Button
            onClick={handlePurchase}
            disabled={processing}
            className="w-full h-14 text-base font-bold gap-2 hover:glow-primary"
            size="lg"
          >
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Comprar Agora
              </>
            )}
          </Button>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" /> Pagamento seguro
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-4 w-4" /> Acesso imediato
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
