CREATE TABLE public.product_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  platform text NOT NULL,
  pixel_id text NOT NULL,
  access_token text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pixels for checkout"
  ON public.product_pixels FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Producers can manage own product pixels"
  ON public.product_pixels FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products WHERE products.id = product_pixels.product_id AND products.producer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products WHERE products.id = product_pixels.product_id AND products.producer_id = auth.uid()
  ));