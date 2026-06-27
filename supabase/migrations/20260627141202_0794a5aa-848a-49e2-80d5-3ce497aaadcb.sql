
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

DROP POLICY IF EXISTS "admin can edit messages" ON public.support_messages;
CREATE POLICY "admin can edit messages"
  ON public.support_messages
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin can delete messages" ON public.support_messages;
CREATE POLICY "admin can delete messages"
  ON public.support_messages
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
