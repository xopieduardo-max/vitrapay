ALTER TABLE public.pending_payments 
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_term text;