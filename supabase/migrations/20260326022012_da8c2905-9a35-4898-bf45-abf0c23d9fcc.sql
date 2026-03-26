
ALTER TABLE public.transactions DROP CONSTRAINT transactions_category_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_category_check CHECK (category = ANY (ARRAY['sale'::text, 'commission'::text, 'fee'::text, 'withdrawal'::text, 'refund'::text, 'admin-withdrawal'::text, 'admin-service-fee-withdrawal'::text, 'service_fee'::text, 'chargeback'::text, 'med'::text]));
