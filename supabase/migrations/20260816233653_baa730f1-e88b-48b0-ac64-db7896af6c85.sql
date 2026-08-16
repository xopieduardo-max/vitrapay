ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS coming_soon boolean NOT NULL DEFAULT false;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS coming_soon boolean NOT NULL DEFAULT false;