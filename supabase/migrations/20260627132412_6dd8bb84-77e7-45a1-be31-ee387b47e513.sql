-- Make direct signups become producers by default and skip onboarding.
-- Auto-created buyer accounts (from purchases) keep buyer role.
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
    -- Buyer auto-created after a purchase: stays as buyer, no onboarding needed.
    INSERT INTO public.profiles (user_id, display_name, account_type, onboarding_completed)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', 'buyer', true);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
  ELSE
    -- Direct signup on the platform: enters as producer, skips onboarding quiz.
    INSERT INTO public.profiles (user_id, display_name, account_type, onboarding_completed)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', 'producer', true);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'producer');
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: existing users that completed signup but never picked a role,
-- and are not auto-created buyers, should get the producer role too.
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'producer'::app_role
FROM public.profiles p
LEFT JOIN public.user_roles ur
  ON ur.user_id = p.user_id AND ur.role = 'producer'::app_role
WHERE ur.user_id IS NULL
  AND COALESCE(p.account_type, '') <> 'buyer'
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p.user_id
      AND COALESCE((u.raw_user_meta_data->>'auto_created')::boolean, false) = false
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- Mark onboarding as completed for those backfilled producers so they skip the quiz.
UPDATE public.profiles p
SET onboarding_completed = true
WHERE onboarding_completed = false
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role = 'producer'::app_role
  );