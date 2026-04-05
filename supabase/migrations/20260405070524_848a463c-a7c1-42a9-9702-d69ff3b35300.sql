-- Allow admins to insert pending_payments (for fake sales checkout conversion data)
CREATE POLICY "Admins can insert pending_payments"
ON public.pending_payments
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow service role full access on pending_payments
CREATE POLICY "Service role full access on pending_payments"
ON public.pending_payments
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);
