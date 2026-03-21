CREATE TABLE public.pending_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_payment_id text UNIQUE NOT NULL,
  product_id uuid NOT NULL,
  buyer_name text,
  buyer_email text,
  buyer_cpf text,
  amount integer NOT NULL,
  affiliate_ref text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pending payments"
  ON public.pending_payments FOR SELECT
  TO anon, authenticated
  USING (true);