
-- 1) Customizations table
CREATE TABLE IF NOT EXISTS public.award_tier_customizations (
  tier_name text PRIMARY KEY,
  title text,
  description text,
  image_url text,
  rewards jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.award_tier_customizations TO anon, authenticated;
GRANT ALL ON public.award_tier_customizations TO service_role;

ALTER TABLE public.award_tier_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tier_custom_public_read"
  ON public.award_tier_customizations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "tier_custom_admin_write"
  ON public.award_tier_customizations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Storage bucket for tier images
INSERT INTO storage.buckets (id, name, public)
VALUES ('award-tier-images', 'award-tier-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "award_tier_img_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'award-tier-images');

CREATE POLICY "award_tier_img_admin_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'award-tier-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "award_tier_img_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'award-tier-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "award_tier_img_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'award-tier-images' AND public.has_role(auth.uid(), 'admin'));
