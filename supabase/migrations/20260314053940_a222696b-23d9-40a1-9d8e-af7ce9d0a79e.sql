ALTER TABLE public.sales DROP CONSTRAINT sales_payment_provider_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_provider_check 
CHECK (payment_provider = ANY (ARRAY['stripe', 'mercadopago', 'simulated', 'pix', 'card', 'boleto']));