CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.profiles (user_id, display_name, onboarding_completed) 
    VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', false);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
    RETURN NEW;
END;
$function$;