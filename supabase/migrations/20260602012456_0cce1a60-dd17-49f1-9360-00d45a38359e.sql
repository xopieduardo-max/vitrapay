-- 1) Garantir RLS habilitada
ALTER TABLE public.product_pixels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pixels FORCE ROW LEVEL SECURITY;

-- 2) Remover qualquer policy antiga de leitura anônima (se existir)
DROP POLICY IF EXISTS "Anyone can view active pixels via public view" ON public.product_pixels;
DROP POLICY IF EXISTS "Public can view active pixels" ON public.product_pixels;
DROP POLICY IF EXISTS "Anon can view active pixels" ON public.product_pixels;

-- 3) Revogar qualquer privilégio que anon possa ter na tabela base
REVOKE ALL ON public.product_pixels FROM anon;
REVOKE ALL ON public.product_pixels FROM PUBLIC;

-- 4) Garantir que service_role (edge functions) tem acesso total — usado por send-facebook-capi
GRANT ALL ON public.product_pixels TO service_role;

-- 5) Policy explícita para service_role (defesa em profundidade)
DROP POLICY IF EXISTS "Service role full access on product_pixels" ON public.product_pixels;
CREATE POLICY "Service role full access on product_pixels"
  ON public.product_pixels FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6) Recriar a view pública garantindo security_invoker e ausência de access_token
DROP VIEW IF EXISTS public.product_pixels_public;
CREATE VIEW public.product_pixels_public
WITH (security_invoker = true) AS
SELECT id, product_id, platform, pixel_id, is_active, config
FROM public.product_pixels
WHERE is_active = true;

-- 7) Permitir leitura pública APENAS da view segura
GRANT SELECT ON public.product_pixels_public TO anon, authenticated;

-- 8) Garantir que produtores ainda consigam ler seus próprios pixels (com access_token) via a tabela
--    (a policy "Producers can manage own product pixels" já cobre, mas reforçamos com GRANT)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_pixels TO authenticated;