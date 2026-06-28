ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS buyer_interest INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS installment_count INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.sales.buyer_interest IS 'Installment interest charged to the buyer that is retained by the platform (cents).';
COMMENT ON COLUMN public.sales.installment_count IS 'Number of installments selected by the buyer (1 = à vista).';