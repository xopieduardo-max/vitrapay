-- Trigger que impede mudanças na chave PIX sem 2FA
CREATE OR REPLACE FUNCTION public.guard_pix_key_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pix_changed boolean;
  v_authorized text;
  v_is_admin boolean;
BEGIN
  v_pix_changed :=
    COALESCE(NEW.pix_key, '') IS DISTINCT FROM COALESCE(OLD.pix_key, '')
    OR COALESCE(NEW.pix_key_type, '') IS DISTINCT FROM COALESCE(OLD.pix_key_type, '');

  IF NOT v_pix_changed THEN
    RETURN NEW;
  END IF;

  -- Service role e admin podem ajustar manualmente
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  v_authorized := current_setting('app.pix_change_authorized', true);
  IF v_authorized = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'pix_key change requires 2FA confirmation'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_pix_key_change ON public.profiles;
CREATE TRIGGER trg_guard_pix_key_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_pix_key_change();

-- Reescreve update_pix_key_with_token para autorizar a sessão
CREATE OR REPLACE FUNCTION public.update_pix_key_with_token(
  _token uuid,
  _pix_key text,
  _pix_key_type text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _pix_key IS NULL OR length(trim(_pix_key)) = 0 THEN
    RAISE EXCEPTION 'pix_key required';
  END IF;
  IF _pix_key_type NOT IN ('cpf','cnpj','email','phone','random_key') THEN
    RAISE EXCEPTION 'invalid pix_key_type';
  END IF;

  SELECT public.consume_action_token(v_uid, 'pix_change', _token) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'invalid_or_expired_token';
  END IF;

  -- Libera o trigger para esta transação apenas
  PERFORM set_config('app.pix_change_authorized', 'true', true);

  UPDATE public.profiles
     SET pix_key = trim(_pix_key),
         pix_key_type = _pix_key_type,
         updated_at = now()
   WHERE user_id = v_uid;

  PERFORM set_config('app.pix_change_authorized', 'false', true);

  RETURN true;
END;
$$;