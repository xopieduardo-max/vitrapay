
CREATE TABLE IF NOT EXISTS public.milestone_seen (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone BIGINT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestone_seen TO authenticated;
GRANT ALL ON public.milestone_seen TO service_role;
ALTER TABLE public.milestone_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own milestone_seen" ON public.milestone_seen
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
