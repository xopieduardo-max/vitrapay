-- Platform banners (shown in producer dashboard)
CREATE TABLE public.platform_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  link_url text,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active banners" ON public.platform_banners FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins can manage banners" ON public.platform_banners FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Platform popups (shown on login/dashboard)
CREATE TABLE public.platform_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  image_url text,
  button_text text DEFAULT 'Entendi',
  button_url text,
  is_active boolean NOT NULL DEFAULT true,
  show_once boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active popups" ON public.platform_popups FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins can manage popups" ON public.platform_popups FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));