DELETE FROM pgmq.q_transactional_emails
WHERE (message->>'idempotency_key') IS NULL AND (message->>'run_id') IS NULL;

DELETE FROM public.email_send_log
WHERE template_name = 'transactional_emails' AND status IN ('failed','dlq');