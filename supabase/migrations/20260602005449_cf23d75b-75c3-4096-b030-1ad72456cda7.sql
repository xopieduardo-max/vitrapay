-- 1) Tornar o bucket privado
UPDATE storage.buckets SET public = false WHERE id = 'product-files';

-- 2) Remover políticas antigas do bucket product-files (se existirem) para reescrever do zero
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'product_files_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 3) Políticas restritivas para o bucket product-files

-- Produtor (uploader) pode enviar arquivos
CREATE POLICY "product_files_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-files' AND owner = auth.uid());

-- Produtor pode ler somente os arquivos que enviou
CREATE POLICY "product_files_owner_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-files' AND owner = auth.uid());

-- Produtor pode atualizar/apagar somente os arquivos que enviou
CREATE POLICY "product_files_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-files' AND owner = auth.uid())
WITH CHECK (bucket_id = 'product-files' AND owner = auth.uid());

CREATE POLICY "product_files_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-files' AND owner = auth.uid());

-- Service role tem acesso total (para a edge function gerar signed URLs)
CREATE POLICY "product_files_service_all"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'product-files')
WITH CHECK (bucket_id = 'product-files');