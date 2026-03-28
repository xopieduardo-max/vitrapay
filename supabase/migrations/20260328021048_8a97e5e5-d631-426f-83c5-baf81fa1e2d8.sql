
CREATE TABLE public.media_playback_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.product_files(id) ON DELETE CASCADE,
  progress_seconds numeric NOT NULL DEFAULT 0,
  duration_seconds numeric DEFAULT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_id)
);

ALTER TABLE public.media_playback_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own playback progress"
  ON public.media_playback_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own playback progress"
  ON public.media_playback_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playback progress"
  ON public.media_playback_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
