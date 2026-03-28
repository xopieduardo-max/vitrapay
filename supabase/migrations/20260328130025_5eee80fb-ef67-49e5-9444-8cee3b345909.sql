
ALTER TABLE public.pending_payments 
ADD COLUMN IF NOT EXISTS recovery_notified_at timestamp with time zone DEFAULT NULL;

-- Cron job to run recovery every 10 minutes
SELECT cron.schedule(
  'recover-abandoned-carts',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/recover-abandoned-carts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
