
INSERT INTO storage.buckets (id, name, public) VALUES ('checkout-images', 'checkout-images', true);

CREATE POLICY "Authenticated users can upload checkout images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checkout-images');

CREATE POLICY "Anyone can view checkout images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'checkout-images');

CREATE POLICY "Authenticated users can delete own checkout images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checkout-images' AND (storage.foldername(name))[1] = auth.uid()::text);
