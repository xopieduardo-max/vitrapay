CREATE OR REPLACE FUNCTION public.get_payment_status(_payment_id text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.pending_payments WHERE asaas_payment_id = _payment_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_status(text) TO anon, authenticated, service_role;