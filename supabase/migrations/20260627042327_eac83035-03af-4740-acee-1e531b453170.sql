CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

  SELECT count(*) INTO v_recent_count
  FROM public.sensitive_action_challenges
  WHERE user_id = _user_id
    AND action = _action
    AND created_at > now() - interval '1 hour';
  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  UPDATE public.sensitive_action_challenges
  SET used_at = now()
  WHERE user_id = _user_id AND action = _action AND used_at IS NULL;

  INSERT INTO public.sensitive_action_challenges
    (user_id, action, code_hash, expires_at, ip, user_agent)
  VALUES (
    _user_id,
    _action,
    encode(extensions.digest(_code::text, 'sha256'::text), 'hex'),
    now() + interval '10 minutes',
    _ip,
    _ua
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sensitive_challenge(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sensitive_challenge(uuid,text,text,text,text) TO service_role;

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

  v_hash := encode(extensions.digest(_code::text, 'sha256'::text), 'hex');

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