
DROP POLICY IF EXISTS "support_attachments_read" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_delete_own" ON storage.objects;

CREATE POLICY "support_attachments_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "support_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "support_attachments_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
