CREATE POLICY "Users can add producer role to themselves"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND role = 'producer'::app_role
);