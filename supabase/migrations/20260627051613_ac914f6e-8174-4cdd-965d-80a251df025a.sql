CREATE TABLE public.admin_whatsapp_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_whatsapp_recipients TO authenticated;
GRANT ALL ON public.admin_whatsapp_recipients TO service_role;

ALTER TABLE public.admin_whatsapp_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whatsapp recipients"
ON public.admin_whatsapp_recipients
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_admin_whatsapp_recipients_updated_at
BEFORE UPDATE ON public.admin_whatsapp_recipients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.admin_whatsapp_recipients (phone, label)
VALUES ('43984220303', 'Admin principal')
ON CONFLICT (phone) DO NOTHING;