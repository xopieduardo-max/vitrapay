
-- Drop conflicting old policies and recreate clean ones
DROP POLICY IF EXISTS "Producers can manage modules" ON public.modules;
DROP POLICY IF EXISTS "Users with access can view modules" ON public.modules;
DROP POLICY IF EXISTS "Authenticated can read modules for accessible products" ON public.modules;

-- Simple policy: any authenticated user can SELECT modules (RLS on lessons still protects content)
CREATE POLICY "Authenticated can read all modules"
ON public.modules FOR SELECT TO authenticated
USING (true);

-- Producers can manage (insert/update/delete) their own modules
CREATE POLICY "Producers can manage own modules"
ON public.modules FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.products WHERE products.id = modules.product_id AND products.producer_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.products WHERE products.id = modules.product_id AND products.producer_id = auth.uid())
);

-- Same for lessons
DROP POLICY IF EXISTS "Producers can manage lessons" ON public.lessons;
DROP POLICY IF EXISTS "Users with access can view lessons" ON public.lessons;

CREATE POLICY "Authenticated can read accessible lessons"
ON public.lessons FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.product_access pa ON pa.product_id = m.product_id
    WHERE m.id = lessons.module_id AND pa.user_id = auth.uid()
  )
  OR is_free = true
  OR EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.products p ON p.id = m.product_id
    WHERE m.id = lessons.module_id AND p.producer_id = auth.uid()
  )
);

CREATE POLICY "Producers can manage own lessons"
ON public.lessons FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.modules m JOIN public.products p ON p.id = m.product_id WHERE m.id = lessons.module_id AND p.producer_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.modules m JOIN public.products p ON p.id = m.product_id WHERE m.id = lessons.module_id AND p.producer_id = auth.uid())
);
