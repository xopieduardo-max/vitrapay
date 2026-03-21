ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS already_sells boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_revenue text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_platform text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS referral_source text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;