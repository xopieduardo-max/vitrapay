
-- Workspaces table
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Meu Workspace',
  slug TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#EAB308',
  secondary_color TEXT DEFAULT '#1A1A1A',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(slug)
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Producers can manage own workspaces
CREATE POLICY "Producers can manage own workspaces"
ON public.workspaces
FOR ALL
TO authenticated
USING (producer_id = auth.uid())
WITH CHECK (producer_id = auth.uid());

-- Anyone can view public workspaces
CREATE POLICY "Anyone can view public workspaces"
ON public.workspaces
FOR SELECT
TO anon, authenticated
USING (is_public = true);

-- Junction table: which products appear in which workspace
CREATE TABLE public.workspace_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, product_id)
);

ALTER TABLE public.workspace_products ENABLE ROW LEVEL SECURITY;

-- Producers can manage workspace products
CREATE POLICY "Producers can manage workspace products"
ON public.workspace_products
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workspaces w
  WHERE w.id = workspace_products.workspace_id
  AND w.producer_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.workspaces w
  WHERE w.id = workspace_products.workspace_id
  AND w.producer_id = auth.uid()
));

-- Buyers can view visible workspace products
CREATE POLICY "Anyone can view visible workspace products"
ON public.workspace_products
FOR SELECT
TO anon, authenticated
USING (is_visible = true AND EXISTS (
  SELECT 1 FROM public.workspaces w
  WHERE w.id = workspace_products.workspace_id
  AND w.is_public = true
));
