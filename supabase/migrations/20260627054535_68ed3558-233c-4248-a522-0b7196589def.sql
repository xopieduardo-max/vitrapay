
-- Remove public anon access to coupons and add safe validation RPC
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _product_id uuid)
RETURNS TABLE(valid boolean, discount_type text, discount_value integer, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producer uuid;
  v_coupon public.coupons%ROWTYPE;
BEGIN
  SELECT producer_id INTO v_producer FROM public.products WHERE id = _product_id;
  IF v_producer IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::integer, 'product_not_found'::text;
    RETURN;
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE code = upper(trim(_code))
    AND producer_id = v_producer
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::integer, 'invalid'::text;
    RETURN;
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::text, NULL::integer, 'expired'::text;
    RETURN;
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND COALESCE(v_coupon.uses, 0) >= v_coupon.max_uses THEN
    RETURN QUERY SELECT false, NULL::text, NULL::integer, 'exhausted'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_coupon.discount_type, v_coupon.discount_value, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid) TO anon, authenticated;

-- Fix mutable search_path on email queue helper functions
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
