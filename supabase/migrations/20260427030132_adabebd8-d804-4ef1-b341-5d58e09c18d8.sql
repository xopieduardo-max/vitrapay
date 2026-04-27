
-- Função atômica: insere sale + transactions (sale credit + fee debit) + atualiza wallet
-- Tudo em uma única transação. Se algo falhar, tudo é revertido.
CREATE OR REPLACE FUNCTION public.insert_fake_sale_atomic(
  p_sale_id uuid,
  p_product_id uuid,
  p_producer_id uuid,
  p_amount integer,
  p_platform_fee integer,
  p_payment_provider text,
  p_payment_id text,
  p_sale_date timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net integer := p_amount - COALESCE(p_platform_fee, 0);
BEGIN
  -- 1) Inserir a venda
  INSERT INTO public.sales (
    id, product_id, producer_id, buyer_id, affiliate_id,
    amount, platform_fee, payment_provider, payment_id,
    status, created_at
  ) VALUES (
    p_sale_id, p_product_id, p_producer_id, NULL, NULL,
    p_amount, COALESCE(p_platform_fee, 0), p_payment_provider, p_payment_id,
    'completed', p_sale_date
  );

  -- 2) Pending payment (registro de confirmação)
  INSERT INTO public.pending_payments (
    asaas_payment_id, amount, status, product_id, producer_id,
    buyer_name, buyer_email, created_at
  ) VALUES (
    p_payment_id, p_amount, 'confirmed', p_product_id, p_producer_id,
    'Cliente Simulado',
    'fake_' || substring(p_sale_id::text, 1, 6) || '@vitrapay.com',
    p_sale_date
  );

  -- 3) Transação de crédito (venda líquida)
  INSERT INTO public.transactions (
    user_id, type, category, amount, status, balance_type, reference_id, created_at
  ) VALUES (
    p_producer_id, 'credit', 'sale', v_net, 'completed', 'available',
    p_sale_id::text, p_sale_date
  );

  -- 4) Transação de débito (taxa) se aplicável
  IF COALESCE(p_platform_fee, 0) > 0 THEN
    INSERT INTO public.transactions (
      user_id, type, category, amount, status, balance_type, reference_id, created_at
    ) VALUES (
      p_producer_id, 'debit', 'fee', p_platform_fee, 'completed', 'available',
      p_sale_id::text, p_sale_date
    );
  END IF;

  -- 5) Atualizar wallet
  PERFORM public.increment_wallet(
    p_user_id := p_producer_id,
    p_available_delta := v_net::bigint,
    p_total_delta := v_net::bigint
  );
END;
$$;
