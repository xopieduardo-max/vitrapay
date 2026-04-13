-- Add geolocation columns to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS buyer_city text,
  ADD COLUMN IF NOT EXISTS buyer_state text,
  ADD COLUMN IF NOT EXISTS buyer_country text;

-- Add geolocation columns to pending_payments
ALTER TABLE public.pending_payments
  ADD COLUMN IF NOT EXISTS buyer_city text,
  ADD COLUMN IF NOT EXISTS buyer_state text,
  ADD COLUMN IF NOT EXISTS buyer_country text;

-- Index for fast regional queries
CREATE INDEX IF NOT EXISTS idx_sales_buyer_state ON public.sales (buyer_state)
  WHERE buyer_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_buyer_city ON public.sales (buyer_city)
  WHERE buyer_city IS NOT NULL;