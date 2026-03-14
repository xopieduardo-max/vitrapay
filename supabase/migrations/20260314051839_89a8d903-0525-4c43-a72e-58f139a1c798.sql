-- Allow admins to insert and delete sales (for fake sales)
CREATE POLICY "Admins can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sales" ON public.sales FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));