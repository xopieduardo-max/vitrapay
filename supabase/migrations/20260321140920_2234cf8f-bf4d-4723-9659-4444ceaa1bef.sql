
ALTER TABLE public.profiles
  ADD COLUMN custom_fee_percentage numeric DEFAULT NULL,
  ADD COLUMN custom_fee_fixed integer DEFAULT NULL;

COMMENT ON COLUMN public.profiles.custom_fee_percentage IS 'Custom fee percentage override (e.g. 3.89). NULL = use platform default.';
COMMENT ON COLUMN public.profiles.custom_fee_fixed IS 'Custom fixed fee override in centavos (e.g. 249 = R$2.49). NULL = use platform default.';
