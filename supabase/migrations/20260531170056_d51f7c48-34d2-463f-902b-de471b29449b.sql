
CREATE TABLE public.award_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  milestone bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  shipping_name text,
  shipping_phone text,
  shipping_cep text,
  shipping_street text,
  shipping_number text,
  shipping_complement text,
  shipping_neighborhood text,
  shipping_city text,
  shipping_state text,
  tracking_code text,
  admin_notes text,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone)
);

GRANT SELECT, INSERT, UPDATE ON public.award_requests TO authenticated;
GRANT ALL ON public.award_requests TO service_role;

ALTER TABLE public.award_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own award requests"
  ON public.award_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own award requests"
  ON public.award_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own award requests pending"
  ON public.award_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any award request"
  ON public.award_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_award_requests_updated_at
  BEFORE UPDATE ON public.award_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_award_requests_status ON public.award_requests(status);
CREATE INDEX idx_award_requests_user ON public.award_requests(user_id);
