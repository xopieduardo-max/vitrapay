-- Add suspension support to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Index for fast lookup of suspended users
CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended
  ON public.profiles (is_suspended)
  WHERE is_suspended = true;
