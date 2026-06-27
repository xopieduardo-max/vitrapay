DO $$
DECLARE
  v_token text;
BEGIN
  SELECT token INTO v_token FROM public.email_unsubscribe_tokens WHERE email = 'xopieduardo@gmail.com' LIMIT 1;
  IF v_token IS NULL THEN
    v_token := replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.email_unsubscribe_tokens (email, token) VALUES ('xopieduardo@gmail.com', v_token);
  END IF;

  PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
    'message_id', gen_random_uuid()::text,
    'idempotency_key', 'manual-test-' || extract(epoch from now())::text,
    'to', 'xopieduardo@gmail.com',
    'from', 'VitraPay <noreply@vitrapay.com.br>',
    'sender_domain', 'notify.vitrapay.com.br',
    'subject', 'Teste de envio VitraPay ✅',
    'html', '<html><body style="font-family:Arial;padding:24px;background:#fff"><h2 style="color:#0a0a0a">Teste VitraPay ✅</h2><p>Este é um e-mail de teste para confirmar que a fila de envio está funcionando corretamente.</p><p>Se você recebeu, está tudo certo!</p><p style="color:#666;font-size:12px">VitraPay - Plataforma de pagamentos digitais</p></body></html>',
    'text', 'Teste VitraPay - se você recebeu, o envio está OK.',
    'purpose', 'transactional',
    'label', 'manual_test',
    'unsubscribe_token', v_token,
    'queued_at', now()::text
  ));
END $$;