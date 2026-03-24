
-- Add release_date and status columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS release_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

-- Set release_date for existing pending transactions (D+2 from creation)
UPDATE public.transactions
SET release_date = created_at + interval '2 days',
    status = 'pending'
WHERE balance_type = 'pending' AND release_date IS NULL;

-- Set release_date = created_at for existing available transactions
UPDATE public.transactions
SET release_date = created_at
WHERE balance_type = 'available' AND release_date IS NULL;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
