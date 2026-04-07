
CREATE TABLE public.scheduled_fake_pushes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  url text DEFAULT '/sales',
  scheduled_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_fake_pushes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on scheduled_fake_pushes"
ON public.scheduled_fake_pushes
FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can manage scheduled pushes"
ON public.scheduled_fake_pushes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_scheduled_fake_pushes_pending
ON public.scheduled_fake_pushes (scheduled_at)
WHERE sent_at IS NULL;
