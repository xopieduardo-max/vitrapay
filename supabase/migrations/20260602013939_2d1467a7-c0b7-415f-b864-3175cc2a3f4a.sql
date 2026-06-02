-- =====================================================================
-- Hardening final de segurança
-- =====================================================================

-- 1) Bloquear LISTAGEM no bucket product-files (continua acessível por URL
--    pública pois o bucket é público, mas não permite listar arquivos).
--    Deliverables pagos já vivem em 'product-deliverables' (privado).
DROP POLICY IF EXISTS "Public can view product files" ON storage.objects;

-- 2) Revogar EXECUTE de funções SECURITY DEFINER sensíveis dos roles
--    anon/authenticated. Apenas service_role (chamadas internas) pode usar.
REVOKE EXECUTE ON FUNCTION public.get_user_emails() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_financial_integrity(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_fake_sale_atomic(uuid, uuid, uuid, integer, integer, text, text, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_sensitive_challenge(uuid, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mask_sensitive(text) FROM anon, authenticated;

-- Revogar de anon (mantém para authenticated) funções que dependem de auth.uid()
REVOKE EXECUTE ON FUNCTION public.consume_sensitive_challenge(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_action_token(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_pix_key_with_token(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.self_assign_producer_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_login_attempt(text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_email() FROM anon;