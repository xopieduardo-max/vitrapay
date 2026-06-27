
DROP POLICY IF EXISTS "support_attachments_read" ON storage.objects;
CREATE POLICY "support_attachments_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments');

DROP POLICY IF EXISTS "support_attachments_insert" ON storage.objects;
CREATE POLICY "support_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments');

DROP POLICY IF EXISTS "support_attachments_delete_own" ON storage.objects;
CREATE POLICY "support_attachments_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'support-attachments' AND owner = auth.uid());
