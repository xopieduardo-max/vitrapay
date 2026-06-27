DROP POLICY IF EXISTS "users read own challenges" ON public.sensitive_action_challenges;
REVOKE SELECT ON public.sensitive_action_challenges FROM authenticated;
GRANT ALL ON public.sensitive_action_challenges TO service_role;