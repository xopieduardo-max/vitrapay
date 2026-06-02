-- Tabela de dispositivos conhecidos por usuário
CREATE TABLE public.user_known_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_hash text NOT NULL,
  ip text,
  user_agent text,
  device_label text,
  trusted boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  login_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_hash)
);

CREATE INDEX idx_user_known_devices_user ON public.user_known_devices(user_id);

GRANT SELECT, UPDATE, DELETE ON public.user_known_devices TO authenticated;
GRANT ALL ON public.user_known_devices TO service_role;

ALTER TABLE public.user_known_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON public.user_known_devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own devices"
  ON public.user_known_devices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON public.user_known_devices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access devices"
  ON public.user_known_devices FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Função para registrar login e detectar dispositivo novo
CREATE OR REPLACE FUNCTION public.register_login_attempt(
  _device_hash text,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _device_label text DEFAULT NULL
)
RETURNS TABLE(is_new_device boolean, device_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.user_known_devices%ROWTYPE;
  v_id uuid;
  v_total_devices int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _device_hash IS NULL OR length(_device_hash) = 0 THEN
    RAISE EXCEPTION 'device_hash_required';
  END IF;

  SELECT * INTO v_existing
  FROM public.user_known_devices
  WHERE user_id = v_uid AND device_hash = _device_hash;

  IF FOUND THEN
    UPDATE public.user_known_devices
       SET last_seen_at = now(),
           login_count = login_count + 1,
           ip = COALESCE(_ip, ip),
           user_agent = COALESCE(_user_agent, user_agent)
     WHERE id = v_existing.id;
    RETURN QUERY SELECT false, v_existing.id;
    RETURN;
  END IF;

  -- Dispositivo novo
  INSERT INTO public.user_known_devices
    (user_id, device_hash, ip, user_agent, device_label, trusted)
  VALUES (v_uid, _device_hash, _ip, _user_agent, _device_label, false)
  RETURNING id INTO v_id;

  -- Conta total de dispositivos: se for o primeiro, considera "novo" mas não alerta
  SELECT count(*) INTO v_total_devices
  FROM public.user_known_devices
  WHERE user_id = v_uid;

  -- Loga no audit
  INSERT INTO public.security_audit_log (user_id, event_type, metadata)
  VALUES (
    v_uid,
    'new_device_login',
    jsonb_build_object(
      'ip', _ip,
      'user_agent', _user_agent,
      'device_label', _device_label,
      'first_device', v_total_devices = 1
    )
  );

  -- Se for o primeiro dispositivo, não conta como "novo suspeito"
  RETURN QUERY SELECT (v_total_devices > 1), v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_login_attempt(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_login_attempt(text, text, text, text) TO authenticated;

-- Permitir 'new_device_login' no log_security_event
CREATE OR REPLACE FUNCTION public.log_security_event(_event_type text, _metadata jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_allowed text[] := ARRAY['password_changed','login_failed','withdrawal_requested','two_fa_changed','new_device_login','device_trusted','device_revoked'];
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
$function$;