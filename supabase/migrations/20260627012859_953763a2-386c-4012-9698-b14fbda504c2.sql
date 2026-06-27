ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS buyer_ip text;
CREATE INDEX IF NOT EXISTS pending_payments_buyer_ip_idx ON public.pending_payments(buyer_ip) WHERE buyer_ip IS NOT NULL;