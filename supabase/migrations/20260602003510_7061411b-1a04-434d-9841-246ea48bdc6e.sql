
-- Reverte a abordagem por GRANT de coluna (estava bloqueando self-read)
DROP POLICY IF EXISTS "Public profile lookup via view" ON public.profiles;

-- Reconcede acesso completo de colunas; RLS controla quais LINHAS aparecem
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

-- Substitui a view por SECURITY DEFINER (bypassa RLS, expõe APENAS campos públicos)
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, bio text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.avatar_url, p.bio
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

-- View pública apenas para listagens completas (comunidade etc.)
CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT user_id, display_name, avatar_url, bio
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
