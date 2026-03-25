
-- Grant proper permissions for modules, lessons, lesson_progress tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO anon, authenticated;
