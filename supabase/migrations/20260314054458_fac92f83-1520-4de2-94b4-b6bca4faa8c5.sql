-- Community suggestions table
CREATE TABLE public.community_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  votes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

-- Votes table
CREATE TABLE public.community_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.community_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

-- Comments table
CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.community_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

-- Suggestions policies
CREATE POLICY "Anyone authenticated can read approved suggestions"
  ON public.community_suggestions FOR SELECT TO authenticated
  USING (status = 'approved' OR user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create suggestions"
  ON public.community_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update suggestions"
  ON public.community_suggestions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete suggestions"
  ON public.community_suggestions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Votes policies
CREATE POLICY "Anyone authenticated can read votes"
  ON public.community_votes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can vote"
  ON public.community_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own vote"
  ON public.community_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone authenticated can read comments on approved suggestions"
  ON public.community_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM community_suggestions s
    WHERE s.id = community_comments.suggestion_id
    AND (s.status = 'approved' OR has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Authenticated users can comment"
  ON public.community_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.community_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Function to update votes count
CREATE OR REPLACE FUNCTION public.update_votes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_suggestions SET votes_count = votes_count + 1 WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_suggestions SET votes_count = votes_count - 1 WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER on_vote_change
  AFTER INSERT OR DELETE ON public.community_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_votes_count();