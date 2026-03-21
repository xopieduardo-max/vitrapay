
DROP POLICY "Service role can insert transactions" ON public.transactions;

CREATE POLICY "Service role full access"
  ON public.transactions FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
