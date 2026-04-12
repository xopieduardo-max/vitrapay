
CREATE TABLE public.scheduled_fake_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id uuid NOT NULL,
  product_id uuid NOT NULL,
  amount integer NOT NULL,
  platform_fee integer NOT NULL DEFAULT 0,
  payment_provider text NOT NULL DEFAULT 'pix',
  payment_id text NOT NULL,
  sale_date timestamp with time zone NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  inserted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_fake_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scheduled fake sales"
ON public.scheduled_fake_sales
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access on scheduled_fake_sales"
ON public.scheduled_fake_sales
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_scheduled_fake_sales_pending ON public.scheduled_fake_sales (scheduled_at) WHERE inserted_at IS NULL;
