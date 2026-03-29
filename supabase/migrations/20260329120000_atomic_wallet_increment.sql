-- Atomic wallet increment function to prevent race conditions
-- Replaces read-then-write pattern with a single atomic SQL operation

CREATE OR REPLACE FUNCTION public.increment_wallet(
  p_user_id UUID,
  p_available_delta BIGINT DEFAULT 0,
  p_pending_delta BIGINT DEFAULT 0,
  p_total_delta BIGINT DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.wallets SET
    balance_available = GREATEST(0, balance_available + p_available_delta),
    balance_pending   = GREATEST(0, balance_pending   + p_pending_delta),
    balance_total     = GREATEST(0, balance_total     + p_total_delta)
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance_available, balance_pending, balance_total)
    VALUES (
      p_user_id,
      GREATEST(0, p_available_delta),
      GREATEST(0, p_pending_delta),
      GREATEST(0, p_total_delta)
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_wallet(UUID, BIGINT, BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_wallet(UUID, BIGINT, BIGINT, BIGINT) TO service_role;
