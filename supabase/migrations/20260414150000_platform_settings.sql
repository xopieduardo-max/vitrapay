-- Add operational settings to platform_fees (single-row config table)
ALTER TABLE public.platform_fees
  ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS withdrawal_fee INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS support_email TEXT NOT NULL DEFAULT 'suporte@vitrapay.com.br',
  ADD COLUMN IF NOT EXISTS min_withdrawal_amount INTEGER NOT NULL DEFAULT 2000;
