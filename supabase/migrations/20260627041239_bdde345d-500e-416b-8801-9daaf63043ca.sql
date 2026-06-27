SELECT pgmq.delete('transactional_emails', 28);
SELECT msg_id, read_ct, message->'idempotency_key' as idem FROM pgmq.q_transactional_emails ORDER BY msg_id;