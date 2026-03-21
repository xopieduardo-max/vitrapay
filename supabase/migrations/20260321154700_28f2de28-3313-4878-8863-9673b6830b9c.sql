
-- Add buyer_email to product_access for guest purchases
ALTER TABLE public.product_access
  ADD COLUMN IF NOT EXISTS buyer_email text DEFAULT NULL;

-- Make user_id nullable so we can grant access to non-registered buyers
ALTER TABLE public.product_access
  ALTER COLUMN user_id DROP NOT NULL;

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_product_access_buyer_email 
  ON public.product_access(buyer_email) WHERE buyer_email IS NOT NULL;

-- RLS policy: allow users to see access by their email
CREATE POLICY "Users can view access by email"
  ON public.product_access
  FOR SELECT
  TO authenticated
  USING (
    buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
