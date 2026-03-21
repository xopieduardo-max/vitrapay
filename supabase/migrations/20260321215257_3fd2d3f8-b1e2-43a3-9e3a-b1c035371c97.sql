
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  category text NOT NULL CHECK (category IN ('sale', 'commission', 'fee', 'withdrawal', 'refund')),
  amount integer NOT NULL,
  balance_type text NOT NULL DEFAULT 'available' CHECK (balance_type IN ('available', 'pending')),
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_transactions_user_id ON public.transactions (user_id);
CREATE INDEX idx_transactions_category ON public.transactions (category);
CREATE INDEX idx_transactions_created_at ON public.transactions (created_at);
