// Server-side validation to prevent price tampering on checkout.
// Recomputes the expected charged amount from the database and rejects
// any request where the client-supplied amount is lower than expected.

export interface AmountValidationInput {
  supabase: any;
  product: { id: string; price: number; producer_id: string };
  amount: number;          // total charged sent by client (in cents)
  service_fee: number;     // cents
  coupon_code?: string | null;
  bump_ids?: string[] | null;
}

export interface AmountValidationResult {
  ok: boolean;
  error?: string;
  expected?: number;
  productAmount?: number;  // amount without service_fee, after bumps + coupon
}

export async function validatePaymentAmount(
  input: AmountValidationInput
): Promise<AmountValidationResult> {
  const { supabase, product, amount, service_fee } = input;
  const couponCode = (input.coupon_code || "").trim().toUpperCase();
  const bumpIds = Array.isArray(input.bump_ids) ? input.bump_ids.filter(Boolean) : [];

  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Valor inválido" };
  }
  if (!Number.isInteger(service_fee) || service_fee < 0) {
    return { ok: false, error: "Service fee inválido" };
  }
  if (!product || typeof product.price !== "number") {
    return { ok: false, error: "Produto inválido" };
  }

  let expectedProductAmount = product.price;

  // Order bumps (must be active and tied to this product)
  if (bumpIds.length > 0) {
    const { data: bumps, error: bumpsErr } = await supabase
      .from("order_bumps")
      .select("id, discount_percentage, is_active, product_id, bump_product:bump_product_id(price)")
      .in("id", bumpIds)
      .eq("product_id", product.id)
      .eq("is_active", true);

    if (bumpsErr) return { ok: false, error: "Erro ao validar order bumps" };

    const validIds = new Set((bumps || []).map((b: any) => b.id));
    for (const id of bumpIds) {
      if (!validIds.has(id)) {
        return { ok: false, error: "Order bump inválido" };
      }
    }
    for (const b of bumps || []) {
      const bp = b.bump_product?.price || 0;
      const discount = Number(b.discount_percentage) || 0;
      expectedProductAmount += Math.round(bp * (1 - discount / 100));
    }
  }

  // Coupon (must belong to producer, active, not expired, not exhausted)
  if (couponCode) {
    const { data: coupon, error: couponErr } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, max_uses, uses, expires_at, is_active, producer_id")
      .eq("code", couponCode)
      .eq("producer_id", product.producer_id)
      .eq("is_active", true)
      .maybeSingle();

    if (couponErr) return { ok: false, error: "Erro ao validar cupom" };
    if (!coupon) return { ok: false, error: "Cupom inválido" };
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { ok: false, error: "Cupom expirado" };
    }
    if (coupon.max_uses != null && (coupon.uses ?? 0) >= coupon.max_uses) {
      return { ok: false, error: "Cupom esgotado" };
    }

    if (coupon.discount_type === "percentage") {
      expectedProductAmount = Math.round(
        expectedProductAmount * (1 - Number(coupon.discount_value) / 100)
      );
    } else {
      expectedProductAmount = Math.max(
        0,
        expectedProductAmount - Number(coupon.discount_value)
      );
    }
  }

  const expected = expectedProductAmount + service_fee;

  // Allow a small 2-cent rounding tolerance, but client must never pay LESS.
  const TOLERANCE = 2;
  if (amount + TOLERANCE < expected) {
    return {
      ok: false,
      error: "Valor do pagamento não confere com o preço do produto",
      expected,
    };
  }

  return { ok: true, expected, productAmount: expectedProductAmount };
}
