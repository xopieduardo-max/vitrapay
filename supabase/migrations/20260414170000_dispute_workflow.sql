-- Add dispute workflow fields to sales table
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS dispute_note TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMP WITH TIME ZONE;
