-- Add unique index on sales.payment_id to prevent duplicate sales at DB level
CREATE UNIQUE INDEX IF NOT EXISTS sales_payment_id_unique ON public.sales (payment_id) WHERE payment_id IS NOT NULL;

-- Allow service role (used by edge functions) to update sales status for refunds
-- Note: service_role bypasses RLS, but we need a policy for edge functions using anon key
-- The webhook uses service_role so it already bypasses RLS

-- Add update policy for admins to manage sale status  
CREATE POLICY "Admins can update sales" ON public.sales
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow commissions to be updated (for cancellation on refunds)
CREATE POLICY "Admins can update commissions" ON public.commissions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));