
CREATE TABLE public.checkout_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers can manage checkout blocks"
  ON public.checkout_blocks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM products WHERE products.id = checkout_blocks.product_id AND products.producer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = checkout_blocks.product_id AND products.producer_id = auth.uid()));

CREATE POLICY "Anyone can read active checkout blocks"
  ON public.checkout_blocks FOR SELECT TO anon, authenticated
  USING (is_active = true);
