
-- Revert: new signups go through onboarding quiz again (default buyer)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auto_created boolean := COALESCE((NEW.raw_user_meta_data->>'auto_created')::boolean, false);
BEGIN
  IF v_auto_created THEN
    -- Buyer auto-created after a purchase: stays as buyer, no onboarding.
    INSERT INTO public.profiles (user_id, display_name, account_type, onboarding_completed)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', 'buyer', true);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
  ELSE
    -- Direct signup: starts as buyer + onboarding quiz pending. Becomes producer on first product creation.
    INSERT INTO public.profiles (user_id, display_name, account_type, onboarding_completed)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', 'buyer', false);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
  END IF;
  RETURN NEW;
END;
$function$;

-- Auto-promote to producer when the user creates their first product
CREATE OR REPLACE FUNCTION public.promote_to_producer_on_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.producer_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.producer_id, 'producer'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
       SET account_type = 'producer',
           onboarding_completed = true,
           updated_at = now()
     WHERE user_id = NEW.producer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_to_producer_on_product ON public.products;
CREATE TRIGGER trg_promote_to_producer_on_product
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.promote_to_producer_on_product();
