DROP POLICY IF EXISTS "Users can read accessible modules" ON public.modules;

CREATE POLICY "Users can read accessible modules"
ON public.modules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.product_access pa
    WHERE pa.product_id = modules.product_id
      AND (
        pa.user_id = auth.uid()
        OR pa.buyer_email = public.get_my_email()
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = modules.product_id
      AND p.producer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Buyers can view purchased product files" ON public.product_files;

CREATE POLICY "Buyers can view purchased product files"
ON public.product_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.product_access pa
    WHERE pa.product_id = product_files.product_id
      AND (
        pa.user_id = auth.uid()
        OR pa.buyer_email = public.get_my_email()
      )
  )
);