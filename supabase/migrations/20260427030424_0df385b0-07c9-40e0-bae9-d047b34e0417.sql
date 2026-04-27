
-- Função: identifica produtores com divergência entre vendas e transações
CREATE OR REPLACE FUNCTION public.check_financial_integrity(
  p_tolerance_cents integer DEFAULT 100
)
RETURNS TABLE (
  producer_id uuid,
  sales_count bigint,
  sales_gross bigint,
  expected_net bigint,
  recorded_net bigint,
  difference bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales_agg AS (
    SELECT
      s.producer_id,
      COUNT(*)::bigint AS sales_count,
      COALESCE(SUM(s.amount), 0)::bigint AS sales_gross,
      COALESCE(SUM(s.amount - COALESCE(s.platform_fee, 0)), 0)::bigint AS expected_net
    FROM public.sales s
    WHERE s.status = 'completed' AND s.producer_id IS NOT NULL
    GROUP BY s.producer_id
  ),
  tx_agg AS (
    SELECT
      t.user_id AS producer_id,
      COALESCE(SUM(CASE WHEN t.type='credit' AND t.category='sale'  THEN t.amount ELSE 0 END), 0)::bigint
        - COALESCE(SUM(CASE WHEN t.type='debit'  AND t.category='fee'   THEN t.amount ELSE 0 END), 0)::bigint
        AS recorded_net
    FROM public.transactions t
    WHERE t.status = 'completed'
      AND ((t.type='credit' AND t.category='sale') OR (t.type='debit' AND t.category='fee'))
    GROUP BY t.user_id
  )
  SELECT
    sa.producer_id,
    sa.sales_count,
    sa.sales_gross,
    sa.expected_net,
    COALESCE(ta.recorded_net, 0) AS recorded_net,
    (sa.expected_net - COALESCE(ta.recorded_net, 0)) AS difference
  FROM sales_agg sa
  LEFT JOIN tx_agg ta ON ta.producer_id = sa.producer_id
  WHERE ABS(sa.expected_net - COALESCE(ta.recorded_net, 0)) > p_tolerance_cents
  ORDER BY ABS(sa.expected_net - COALESCE(ta.recorded_net, 0)) DESC;
$$;

-- Apenas service_role e admins podem executar
REVOKE EXECUTE ON FUNCTION public.check_financial_integrity(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_financial_integrity(integer) TO service_role;
