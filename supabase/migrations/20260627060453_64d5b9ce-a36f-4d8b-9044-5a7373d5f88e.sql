CREATE POLICY "Admins can upload checkout-images banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'checkout-images'
  AND (storage.foldername(name))[1] = 'banners'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update checkout-images banners"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'checkout-images'
  AND (storage.foldername(name))[1] = 'banners'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete checkout-images banners"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'checkout-images'
  AND (storage.foldername(name))[1] = 'banners'
  AND public.has_role(auth.uid(), 'admin')
);