
CREATE POLICY "Authenticated read assistant avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'support-assistants');

CREATE POLICY "Admins insert assistant avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'support-assistants' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update assistant avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'support-assistants' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete assistant avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'support-assistants' AND public.has_role(auth.uid(), 'admin'));
