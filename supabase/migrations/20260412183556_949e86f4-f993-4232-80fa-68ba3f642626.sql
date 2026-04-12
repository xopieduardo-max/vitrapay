
-- Authenticated users need to read other profiles for display_name, avatar_url etc
-- The critical fix was removing anon access - authenticated access is needed for the app
CREATE POLICY "Authenticated can read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (true);
