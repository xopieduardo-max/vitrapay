
CREATE OR REPLACE FUNCTION public.validate_fee_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.category = 'fee' THEN
    IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
      RAISE EXCEPTION 'Fee transaction requires a valid reference_id';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.sales WHERE id::text = NEW.reference_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.withdrawals WHERE id::text = NEW.reference_id
    ) THEN
      RAISE EXCEPTION 'Fee transaction reference_id (%) does not match any sale or withdrawal', NEW.reference_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fee_transaction
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_fee_transaction();
