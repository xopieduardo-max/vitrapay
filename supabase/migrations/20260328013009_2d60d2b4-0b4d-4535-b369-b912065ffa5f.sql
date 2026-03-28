
-- Drop the problematic policy that references auth.users directly
DROP POLICY IF EXISTS "Users can view access by email" ON public.product_access;

-- Create a SECURITY DEFINER function to safely get user email
CREATE OR REPLACE FUNCTION public.get_my_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT email::text FROM auth.users WHERE id = auth.uid()
$$;

-- Recreate the policy using the secure function
CREATE POLICY "Users can view access by email"
ON public.product_access
FOR SELECT
TO authenticated
USING (buyer_email = public.get_my_email());
