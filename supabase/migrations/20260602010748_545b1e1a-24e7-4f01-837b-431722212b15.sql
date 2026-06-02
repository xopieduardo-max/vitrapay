-- 1) Tabela imutável de auditoria
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  old_value text,
  new_value text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_audit_user_created
  ON public.security_audit_log (user_id, created_at DESC);

-- 2) GRANTs
GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;

-- 3) RLS — somente leitura para usuário e admin; sem INSERT/UPDATE/DELETE por roles normais
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_audit"
ON public.security_audit_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "admins_read_all_audit"
ON public.security_audit_log FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "service_role_full_audit"
ON public.security_audit_log FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4) Helper para mascarar valores sensíveis
CREATE OR REPLACE FUNCTION public._mask_sensitive(v text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN v IS NULL OR length(v) = 0 THEN NULL
    WHEN length(v) <= 4 THEN repeat('*', length(v))
    ELSE substr(v, 1, 2) || repeat('*', GREATEST(length(v) - 4, 0)) || substr(v, length(v) - 1)
  END;
$$;

-- 5) Trigger em profiles: registra mudanças de PIX, CPF, telefone, verificação
CREATE OR REPLACE FUNCTION public.log_profile_security_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.pix_key, '') IS DISTINCT FROM COALESCE(OLD.pix_key, '') THEN
    INSERT INTO public.security_audit_log (user_id, event_type, old_value, new_value)
    VALUES (NEW.user_id, 'pix_key_changed',
            public._mask_sensitive(OLD.pix_key),
            public._mask_sensitive(NEW.pix_key));
  END IF;

  IF COALESCE(NEW.pix_key_type, '') IS DISTINCT FROM COALESCE(OLD.pix_key_type, '') THEN
    INSERT INTO public.security_audit_log (user_id, event_type, old_value, new_value)
    VALUES (NEW.user_id, 'pix_key_type_changed', OLD.pix_key_type, NEW.pix_key_type);
  END IF;

  IF COALESCE(NEW.cpf, '') IS DISTINCT FROM COALESCE(OLD.cpf, '') THEN
    INSERT INTO public.security_audit_log (user_id, event_type, old_value, new_value)
    VALUES (NEW.user_id, 'cpf_changed',
            public._mask_sensitive(OLD.cpf),
            public._mask_sensitive(NEW.cpf));
  END IF;

  IF COALESCE(NEW.phone, '') IS DISTINCT FROM COALESCE(OLD.phone, '') THEN
    INSERT INTO public.security_audit_log (user_id, event_type, old_value, new_value)
    VALUES (NEW.user_id, 'phone_changed',
            public._mask_sensitive(OLD.phone),
            public._mask_sensitive(NEW.phone));
  END IF;

  IF COALESCE(NEW.profile_verified, false) IS DISTINCT FROM COALESCE(OLD.profile_verified, false)
     AND NEW.profile_verified = true THEN
    INSERT INTO public.security_audit_log (user_id, event_type, new_value)
    VALUES (NEW.user_id, 'profile_verified', 'true');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_profile_security ON public.profiles;
CREATE TRIGGER trg_log_profile_security
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_security_changes();

-- 6) RPC para o app registrar eventos não-cobertos por trigger (ex: troca de senha)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_allowed text[] := ARRAY['password_changed','login_failed','withdrawal_requested','two_fa_changed'];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (_event_type = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'event_type not allowed';
  END IF;

  INSERT INTO public.security_audit_log (user_id, event_type, metadata)
  VALUES (v_uid, _event_type, _metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, jsonb) TO authenticated;