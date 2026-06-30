
-- TUS resumable upload precisa de SELECT e UPDATE durante chunks.
-- A policy antiga de UPDATE checava foldername[1] = uid, mas o path agora é "lessons/<productId>/...".
-- Trocamos para owner = auth.uid().

DROP POLICY IF EXISTS "Users can update own product files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own product files" ON storage.objects;

CREATE POLICY "Users can read own product files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-files' AND owner = auth.uid());

CREATE POLICY "Users can update own product files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-files' AND owner = auth.uid())
WITH CHECK (bucket_id = 'product-files' AND owner = auth.uid());

CREATE POLICY "Users can delete own product files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-files' AND owner = auth.uid());
