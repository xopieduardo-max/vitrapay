-- 1) Defesa extra: remover qualquer privilégio para anon na tabela base
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM PUBLIC;

-- 2) Garantir FORCE RLS (impede que owner do schema veja sem policy)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- 3) View pública só com campos não sensíveis
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT user_id, display_name, avatar_url, bio
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 4) Garantir grants corretos da tabela base (apenas authenticated + service_role)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

COMMENT ON VIEW public.public_profiles IS
  'Visão pública de perfis sem dados sensíveis (CPF, telefone, endereço, chave PIX). Use esta view para exibir info de outros usuários.';