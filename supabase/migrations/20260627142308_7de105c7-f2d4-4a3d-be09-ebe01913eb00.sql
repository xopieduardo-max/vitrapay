
CREATE TABLE public.support_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role_label text,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.support_assistants TO anon, authenticated;
GRANT ALL ON public.support_assistants TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.support_assistants TO authenticated;

ALTER TABLE public.support_assistants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active assistants"
ON public.support_assistants FOR SELECT
USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert assistants"
ON public.support_assistants FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update assistants"
ON public.support_assistants FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete assistants"
ON public.support_assistants FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_support_assistants_updated
BEFORE UPDATE ON public.support_assistants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS assistant_id uuid REFERENCES public.support_assistants(id) ON DELETE SET NULL;
