CREATE POLICY "Anyone can view active pixels via public view"
ON public.product_pixels
FOR SELECT
TO anon
USING (is_active = true);