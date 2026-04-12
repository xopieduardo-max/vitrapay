
-- 1. Fix pending_payments: remove public read, add scoped policies
DROP POLICY IF EXISTS "Anyone can read pending payments" ON public.pending_payments;

CREATE POLICY "Producers can read own pending payments"
ON public.pending_payments FOR SELECT TO authenticated
USING (producer_id = auth.uid());

-- 2. Fix profiles: replace blanket public read with scoped access
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;

-- Public view: only non-sensitive fields via a secure view
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id, user_id, display_name, avatar_url, bio, created_at
FROM public.profiles;

-- Authenticated users can read their own full profile
CREATE POLICY "Users can read own full profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role full access
CREATE POLICY "Service role can read all profiles"
ON public.profiles FOR SELECT
USING (auth.role() = 'service_role'::text);

-- Public (anon) can read only display fields - use the view instead
-- Grant anon access to the view
GRANT SELECT ON public.profiles_public TO anon;
GRANT SELECT ON public.profiles_public TO authenticated;

-- 3. Fix product_pixels: hide access_token from public
DROP POLICY IF EXISTS "Anyone can read pixels for checkout" ON public.product_pixels;

-- Create a safe view for checkout pixel rendering (no access_token)
CREATE OR REPLACE VIEW public.product_pixels_public AS
SELECT id, product_id, platform, pixel_id, is_active, config
FROM public.product_pixels
WHERE is_active = true;

GRANT SELECT ON public.product_pixels_public TO anon;
GRANT SELECT ON public.product_pixels_public TO authenticated;

-- 4. Fix push_subscriptions: restrict broad read to service_role
DROP POLICY IF EXISTS "Service can read all subscriptions" ON public.push_subscriptions;

CREATE POLICY "Service role can read all subscriptions"
ON public.push_subscriptions FOR SELECT
USING (auth.role() = 'service_role'::text);

-- 5. Fix modules: restrict to owners and buyers
DROP POLICY IF EXISTS "Authenticated can read all modules" ON public.modules;

CREATE POLICY "Users can read accessible modules"
ON public.modules FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM product_access pa
    WHERE pa.product_id = modules.product_id
    AND (pa.user_id = auth.uid() OR pa.buyer_email = (SELECT email::text FROM auth.users WHERE id = auth.uid()))
  )
  OR EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = modules.product_id AND p.producer_id = auth.uid()
  )
);

-- 6. Fix checkout-images upload path ownership
DROP POLICY IF EXISTS "Authenticated users can upload checkout images" ON storage.objects;

CREATE POLICY "Authenticated users can upload own checkout images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checkout-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. Fix function search_path on functions missing it
CREATE OR REPLACE FUNCTION public.increment_wallet(
  p_user_id uuid,
  p_available_delta bigint DEFAULT 0,
  p_pending_delta bigint DEFAULT 0,
  p_total_delta bigint DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wallets SET
    balance_available = GREATEST(0, balance_available + p_available_delta),
    balance_pending   = GREATEST(0, balance_pending   + p_pending_delta),
    balance_total     = GREATEST(0, balance_total     + p_total_delta)
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance_available, balance_pending, balance_total)
    VALUES (p_user_id, GREATEST(0, p_available_delta), GREATEST(0, p_pending_delta), GREATEST(0, p_total_delta));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;
