-- Support for avulso (standalone) Pix charges not tied to a product
-- product_id becomes nullable; producer_id identifies whose wallet to credit

ALTER TABLE public.pending_payments
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.pending_payments
  ADD COLUMN IF NOT EXISTS producer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for webhook lookup
CREATE INDEX IF NOT EXISTS pending_payments_producer_id_idx
  ON public.pending_payments(producer_id);
