-- Scheduled push notifications from admin panel
CREATE TABLE IF NOT EXISTS public.scheduled_admin_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  url text NOT NULL DEFAULT '/dashboard',
  broadcast boolean NOT NULL DEFAULT true,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  sent_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_admin_pushes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scheduled pushes"
  ON public.scheduled_admin_pushes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_scheduled_admin_pushes_scheduled_at
  ON public.scheduled_admin_pushes (scheduled_at)
  WHERE sent_at IS NULL;
