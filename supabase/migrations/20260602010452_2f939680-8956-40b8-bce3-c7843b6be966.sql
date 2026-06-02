-- 1) Reverter product-files para PÚBLICO (restaura capas, logos, banners no marketplace/storefront)
UPDATE storage.buckets SET public = true WHERE id = 'product-files';

-- 2) Remover políticas restritivas anteriores criadas pra esse bucket
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

-- 3) Criar bucket PRIVADO dedicado apenas aos entregáveis baixáveis
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-deliverables', 'product-deliverables', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 4) Políticas: produtor (uploader) faz upload e gerencia seus próprios arquivos
CREATE POLICY "product_deliverables_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-deliverables' AND owner = auth.uid());

CREATE POLICY "product_deliverables_owner_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-deliverables' AND owner = auth.uid());

CREATE POLICY "product_deliverables_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-deliverables' AND owner = auth.uid())
WITH CHECK (bucket_id = 'product-deliverables' AND owner = auth.uid());

CREATE POLICY "product_deliverables_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-deliverables' AND owner = auth.uid());

-- Service role tem acesso total (edge function gera signed URLs)
CREATE POLICY "product_deliverables_service_all"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'product-deliverables')
WITH CHECK (bucket_id = 'product-deliverables');