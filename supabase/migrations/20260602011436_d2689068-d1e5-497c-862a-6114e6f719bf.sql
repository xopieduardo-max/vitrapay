-- =========================================================
-- 2FA por código de e-mail para ações sensíveis
-- =========================================================

CREATE TABLE public.sensitive_action_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('withdraw','pix_change')),
  code_hash text NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  action_token uuid,
  token_expires_at timestamptz,
  token_used_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sac_user_action_active
  ON public.sensitive_action_challenges (user_id, action, created_at DESC);
CREATE INDEX idx_sac_token ON public.sensitive_action_challenges (action_token)
  WHERE action_token IS NOT NULL;

GRANT SELECT ON public.sensitive_action_challenges TO authenticated;
GRANT ALL ON public.sensitive_action_challenges TO service_role;

ALTER TABLE public.sensitive_action_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own challenges"
  ON public.sensitive_action_challenges
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "service role full"
  ON public.sensitive_action_challenges
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================================================
-- RPC: registrar desafio (hash do código), retorna challenge_id
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_sensitive_challenge(
  _user_id uuid,
  _action text,
  _code text,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_recent_count int;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;
  IF _action NOT IN ('withdraw','pix_change') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  -- rate limit: 3 códigos por hora por (user, action)
  SELECT count(*) INTO v_recent_count
  FROM public.sensitive_action_challenges
  WHERE user_id = _user_id
    AND action = _action
    AND created_at > now() - interval '1 hour';
  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  -- invalida desafios anteriores não usados
  UPDATE public.sensitive_action_challenges
  SET used_at = now()
  WHERE user_id = _user_id AND action = _action AND used_at IS NULL;

  INSERT INTO public.sensitive_action_challenges
    (user_id, action, code_hash, expires_at, ip, user_agent)
  VALUES (
    _user_id, _action,
    encode(digest(_code, 'sha256'), 'hex'),
    now() + interval '10 minutes',
    _ip, _ua
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sensitive_challenge(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sensitive_challenge(uuid,text,text,text,text) TO service_role;

-- =========================================================
-- RPC: consumir código → emite action_token (5 min)
-- Pode ser chamado pelo usuário autenticado (próprio)
-- =========================================================
CREATE OR REPLACE FUNCTION public.consume_sensitive_challenge(
  _action text,
  _code text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.sensitive_action_challenges%ROWTYPE;
  v_token uuid := gen_random_uuid();
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _action NOT IN ('withdraw','pix_change') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  v_hash := encode(digest(_code, 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.sensitive_action_challenges
  WHERE user_id = v_uid
    AND action = _action
    AND used_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_challenge';
  END IF;

  IF v_row.expires_at < now() THEN
    UPDATE public.sensitive_action_challenges SET used_at = now() WHERE id = v_row.id;
    RAISE EXCEPTION 'expired';
  END IF;

  IF v_row.attempts >= 5 THEN
    UPDATE public.sensitive_action_challenges SET used_at = now() WHERE id = v_row.id;
    RAISE EXCEPTION 'too_many_attempts';
  END IF;

  IF v_row.code_hash <> v_hash THEN
    UPDATE public.sensitive_action_challenges
       SET attempts = attempts + 1
     WHERE id = v_row.id;
    RAISE EXCEPTION 'invalid_code';
  END IF;

  UPDATE public.sensitive_action_challenges
     SET used_at = now(),
         action_token = v_token,
         token_expires_at = now() + interval '5 minutes'
   WHERE id = v_row.id;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_sensitive_challenge(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_sensitive_challenge(text,text) TO authenticated, service_role;

-- =========================================================
-- RPC: validar e consumir token (usado pelo edge function de saque)
-- =========================================================
CREATE OR REPLACE FUNCTION public.consume_action_token(
  _user_id uuid,
  _action text,
  _token uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.sensitive_action_challenges%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.sensitive_action_challenges
  WHERE action_token = _token
    AND user_id = _user_id
    AND action = _action
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_row.token_used_at IS NOT NULL THEN RETURN false; END IF;
  IF v_row.token_expires_at IS NULL OR v_row.token_expires_at < now() THEN RETURN false; END IF;

  UPDATE public.sensitive_action_challenges
     SET token_used_at = now()
   WHERE id = v_row.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_action_token(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_action_token(uuid,text,uuid) TO service_role;

-- =========================================================
-- RPC: atualizar chave PIX com token (impede mudança sem 2FA)
-- =========================================================
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

  UPDATE public.profiles
     SET pix_key = trim(_pix_key),
         pix_key_type = _pix_key_type,
         updated_at = now()
   WHERE user_id = v_uid;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pix_key_with_token(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_pix_key_with_token(uuid,text,text) TO authenticated;