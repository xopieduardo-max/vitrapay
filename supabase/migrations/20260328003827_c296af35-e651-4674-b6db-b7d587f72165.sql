
-- Drop the problematic SELECT policy on lessons
DROP POLICY IF EXISTS "Authenticated can read accessible lessons" ON public.lessons;

-- Create a security definer function to check lesson access without triggering auth.users permission issues
CREATE OR REPLACE FUNCTION public.user_can_access_lesson(_user_id uuid, _module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM modules m
    JOIN product_access pa ON pa.product_id = m.product_id
    WHERE m.id = _module_id
    AND (pa.user_id = _user_id OR pa.buyer_email = (SELECT email::text FROM auth.users WHERE id = _user_id))
  )
  OR EXISTS (
    SELECT 1 FROM modules m
    JOIN products p ON p.id = m.product_id
    WHERE m.id = _module_id AND p.producer_id = _user_id
  )
$$;

-- Recreate the SELECT policy using the security definer function
CREATE POLICY "Authenticated can read accessible lessons"
ON public.lessons
FOR SELECT
TO authenticated
USING (
  public.user_can_access_lesson(auth.uid(), module_id)
  OR is_free = true
);
