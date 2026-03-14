
CREATE TABLE public.checkout_testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar_url TEXT,
  content TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_testimonials ENABLE ROW LEVEL SECURITY;

-- Producers can manage their own product testimonials
CREATE POLICY "Producers can manage testimonials"
ON public.checkout_testimonials
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = checkout_testimonials.product_id
    AND products.producer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = checkout_testimonials.product_id
    AND products.producer_id = auth.uid()
  )
);

-- Anyone can read active testimonials (for checkout page)
CREATE POLICY "Anyone can read active testimonials"
ON public.checkout_testimonials
FOR SELECT
TO anon, authenticated
USING (is_active = true);
