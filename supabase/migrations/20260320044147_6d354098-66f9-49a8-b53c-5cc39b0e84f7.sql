CREATE TABLE public.push_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  url text DEFAULT '/dashboard',
  sent_count integer DEFAULT 0,
  total_devices integer DEFAULT 0,
  sent_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage push log"
  ON public.push_notifications_log
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));