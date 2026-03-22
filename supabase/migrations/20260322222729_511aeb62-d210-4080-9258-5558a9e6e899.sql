
DROP POLICY "Anyone can read platform fees" ON public.platform_fees;
CREATE POLICY "Anyone can read platform fees" ON public.platform_fees FOR SELECT TO anon, authenticated USING (true);
