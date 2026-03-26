
ALTER TABLE public.transactions DROP CONSTRAINT transactions_category_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_category_check CHECK (category = ANY (ARRAY['sale'::text, 'commission'::text, 'fee'::text, 'withdrawal'::text, 'refund'::text, 'admin-withdrawal'::text, 'service_fee'::text, 'chargeback'::text, 'med'::text]));

-- Insert corrective admin withdrawal to zero out the R$10.70
INSERT INTO public.transactions (user_id, type, category, amount, balance_type, reference_id, release_date, status)
VALUES ('ab4f9f40-3bbf-44c7-a998-5b2b0cdd2744', 'debit', 'admin-withdrawal', 1070, 'available', 'admin-manual-correction', NOW(), 'completed');

-- Expire pending payments older than 24 hours
UPDATE public.pending_payments SET status = 'expired' WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours';
