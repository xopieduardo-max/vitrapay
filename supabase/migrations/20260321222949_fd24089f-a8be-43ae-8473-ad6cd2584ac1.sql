CREATE OR REPLACE FUNCTION public.increment_affiliate_clicks(affiliate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.affiliates
  SET clicks = COALESCE(clicks, 0) + 1
  WHERE id = affiliate_id;
END;
$$;