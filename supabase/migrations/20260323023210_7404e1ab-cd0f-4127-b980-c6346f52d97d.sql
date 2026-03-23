ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS checkout_color_theme text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS checkout_social_proof boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_social_proof_interval integer NOT NULL DEFAULT 30;