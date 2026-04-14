-- Add buyer_ip to pending_payments for IP-based rate limiting
ALTER TABLE public.pending_payments
  ADD COLUMN IF NOT EXISTS buyer_ip TEXT;

-- Index for fast rate limit queries
CREATE INDEX IF NOT EXISTS idx_pending_payments_buyer_cpf_created
  ON public.pending_payments (buyer_cpf, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_payments_buyer_ip_created
  ON public.pending_payments (buyer_ip, created_at DESC);
