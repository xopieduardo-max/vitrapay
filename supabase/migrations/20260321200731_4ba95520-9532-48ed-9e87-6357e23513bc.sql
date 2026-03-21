ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS transfer_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;