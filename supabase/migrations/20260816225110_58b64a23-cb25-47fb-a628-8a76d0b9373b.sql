WITH cand AS (
  SELECT DISTINCT ON (u.id, pa.product_id) pa.id AS access_id, u.id AS uid
  FROM public.product_access pa
  JOIN auth.users u ON lower(u.email) = lower(pa.buyer_email)
  WHERE pa.user_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.product_access pa2
      WHERE pa2.user_id = u.id AND pa2.product_id = pa.product_id
    )
  ORDER BY u.id, pa.product_id, pa.granted_at DESC
)
UPDATE public.product_access pa
SET user_id = cand.uid
FROM cand
WHERE pa.id = cand.access_id;