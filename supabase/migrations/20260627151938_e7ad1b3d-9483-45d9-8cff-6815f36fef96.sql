
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS rating SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_comment TEXT,
  ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;

-- Validation trigger: only owner can rate, only on resolved/closed, only once, 1..5
CREATE OR REPLACE FUNCTION public.validate_support_ticket_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rating IS DISTINCT FROM OLD.rating
     OR COALESCE(NEW.rating_comment,'') IS DISTINCT FROM COALESCE(OLD.rating_comment,'') THEN

    -- Allow service_role and admin bypass
    IF auth.role() = 'service_role'
       OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role)) THEN
      IF NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5) THEN
        RAISE EXCEPTION 'rating must be between 1 and 5';
      END IF;
      IF NEW.rating IS NOT NULL AND NEW.rated_at IS NULL THEN
        NEW.rated_at := now();
      END IF;
      RETURN NEW;
    END IF;

    -- Owner only
    IF auth.uid() IS NULL OR auth.uid() <> OLD.user_id THEN
      RAISE EXCEPTION 'only ticket owner can rate';
    END IF;

    IF OLD.rating IS NOT NULL THEN
      RAISE EXCEPTION 'ticket already rated';
    END IF;

    IF NEW.rating IS NULL OR NEW.rating < 1 OR NEW.rating > 5 THEN
      RAISE EXCEPTION 'rating must be between 1 and 5';
    END IF;

    IF OLD.status NOT IN ('resolved','closed') THEN
      RAISE EXCEPTION 'ticket must be resolved or closed before rating';
    END IF;

    NEW.rated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_support_ticket_rating ON public.support_tickets;
CREATE TRIGGER trg_validate_support_ticket_rating
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.validate_support_ticket_rating();
