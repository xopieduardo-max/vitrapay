
-- Add a policy that allows authenticated users to read modules for products they have access to (by email too)
CREATE POLICY "Authenticated can read modules for accessible products"
ON public.modules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_access pa
    WHERE pa.product_id = modules.product_id
    AND (
      pa.user_id = auth.uid()
      OR pa.buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = modules.product_id AND p.producer_id = auth.uid()
  )
);
