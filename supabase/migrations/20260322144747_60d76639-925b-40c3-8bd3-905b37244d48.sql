-- Single-row config table for platform fees per payment method
CREATE TABLE public.platform_fees (
  id integer PRIMARY KEY DEFAULT 1,
  pix_percentage numeric NOT NULL DEFAULT 0,
  pix_fixed integer NOT NULL DEFAULT 0,
  card_percentage numeric NOT NULL DEFAULT 3.89,
  card_fixed integer NOT NULL DEFAULT 249,
  boleto_percentage numeric NOT NULL DEFAULT 0,
  boleto_fixed integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default values
INSERT INTO public.platform_fees (id) VALUES (1);

-- Enable RLS
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed by edge functions and simulator)
CREATE POLICY "Anyone can read platform fees"
  ON public.platform_fees FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update platform fees"
  ON public.platform_fees FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access on platform_fees"
  ON public.platform_fees FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');