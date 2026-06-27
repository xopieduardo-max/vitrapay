CREATE TABLE public.support_ticket_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_notes TO authenticated;
GRANT ALL ON public.support_ticket_notes TO service_role;

ALTER TABLE public.support_ticket_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all notes"
  ON public.support_ticket_notes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert notes"
  ON public.support_ticket_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid());

CREATE POLICY "Admins can update own notes"
  ON public.support_ticket_notes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid());

CREATE POLICY "Admins can delete own notes"
  ON public.support_ticket_notes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid());

CREATE TRIGGER update_support_ticket_notes_updated_at
  BEFORE UPDATE ON public.support_ticket_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_support_ticket_notes_ticket ON public.support_ticket_notes(ticket_id, created_at DESC);