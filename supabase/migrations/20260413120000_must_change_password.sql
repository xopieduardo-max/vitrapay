-- Add must_change_password flag to profiles
-- Used to force auto-created buyer accounts to set a new password on first login

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Existing users (producers, manual registrations) don't need to change
-- Only auto-created buyers will have this set to true via auto-create-buyer.ts
