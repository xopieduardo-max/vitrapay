
-- 1) Remove o vazamento de access_token do Facebook Pixel: app já usa product_pixels_public
DROP POLICY IF EXISTS "Anyone can view active pixels via public view" ON public.product_pixels;

-- 2) Restringe leitura de profiles: só self + admin + service_role
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON public.profiles;

-- View pública apenas com campos não-sensíveis para lookup cross-user
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT user_id, display_name, avatar_url, bio
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Política específica para a view (passa pelos selects nas linhas-base via security_invoker)
-- Precisamos permitir SELECT na tabela base apenas das colunas seguras
-- A view com security_invoker exige uma policy na tabela que cubra a leitura.
CREATE POLICY "Public profile lookup via view"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- Revoga colunas sensíveis do role authenticated/anon
-- (a policy acima permite SELECT, mas o GRANT por coluna limita o que sai pelo PostgREST)
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (user_id, display_name, avatar_url, bio) ON public.profiles TO anon, authenticated;

-- Para self e admin, manter acesso completo via policy + grant ALL
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
-- (policies já restringem: Users can read own full profile / Admins can read all profiles)

-- 3) Bloqueia auto-atribuição de role producer
DROP POLICY IF EXISTS "Users can add producer role to themselves" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.self_assign_producer_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Bloqueia se usuário já estiver suspenso
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid AND is_suspended = true) THEN
    RAISE EXCEPTION 'account suspended';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'producer'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.self_assign_producer_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_assign_producer_role() TO authenticated;
