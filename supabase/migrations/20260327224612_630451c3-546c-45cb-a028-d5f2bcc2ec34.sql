
CREATE TABLE public.product_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;

-- Producers can manage files for their own products
CREATE POLICY "Producers can manage own product files"
ON public.product_files
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.products
  WHERE products.id = product_files.product_id
  AND products.producer_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products
  WHERE products.id = product_files.product_id
  AND products.producer_id = auth.uid()
));

-- Buyers with access can view product files
CREATE POLICY "Buyers can view purchased product files"
ON public.product_files
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.product_access pa
  WHERE pa.product_id = product_files.product_id
  AND (pa.user_id = auth.uid() OR pa.buyer_email = (SELECT email::text FROM auth.users WHERE id = auth.uid()))
));

-- Service role full access
CREATE POLICY "Service role full access on product_files"
ON public.product_files
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);
