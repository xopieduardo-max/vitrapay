
-- Create storage bucket for product files (covers, downloads)
INSERT INTO storage.buckets (id, name, public) VALUES ('product-files', 'product-files', true);

-- Anyone can view product files
CREATE POLICY "Public can view product files" ON storage.objects FOR SELECT USING (bucket_id = 'product-files');

-- Authenticated users can upload product files
CREATE POLICY "Authenticated users can upload product files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-files');

-- Users can update their own uploaded files
CREATE POLICY "Users can update own product files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own uploaded files
CREATE POLICY "Users can delete own product files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);
