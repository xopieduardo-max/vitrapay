-- card_percentage passa a ser exclusivamente a taxa D+30 (sem antecipação).
-- Nova coluna card_percentage_d2 guarda a taxa com antecipação D+2.
-- Corrige o valor salvo (estava em 4,99%, que é na real a taxa de D+2 —
-- ficou assim porque essa tabela nunca foi lida pelas edge functions até agora).
ALTER TABLE public.platform_fees
  ADD COLUMN IF NOT EXISTS card_percentage_d2 numeric NOT NULL DEFAULT 4.99;

UPDATE public.platform_fees
SET card_percentage = 3.99,
    card_percentage_d2 = 4.99,
    updated_at = now()
WHERE id = 1;
