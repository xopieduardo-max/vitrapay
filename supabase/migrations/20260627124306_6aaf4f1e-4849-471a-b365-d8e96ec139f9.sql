
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

ALTER TABLE public.support_messages ALTER COLUMN body DROP NOT NULL;
