
CREATE TABLE public.support_quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  shortcut TEXT,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_quick_replies TO authenticated;
GRANT ALL ON public.support_quick_replies TO service_role;

ALTER TABLE public.support_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage quick replies"
  ON public.support_quick_replies
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_support_quick_replies_active ON public.support_quick_replies(active, sort_order);

CREATE TRIGGER trg_support_quick_replies_updated_at
  BEFORE UPDATE ON public.support_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
