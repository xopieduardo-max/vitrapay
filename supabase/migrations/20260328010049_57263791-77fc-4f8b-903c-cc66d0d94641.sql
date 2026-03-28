
-- Create lesson_files table for downloadable materials attached to lessons
CREATE TABLE public.lesson_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer DEFAULT 0,
  position integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lesson_files ENABLE ROW LEVEL SECURITY;

-- Producers can manage files for their own lessons
CREATE POLICY "Producers can manage lesson files"
ON public.lesson_files
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lessons l
    JOIN modules m ON m.id = l.module_id
    JOIN products p ON p.id = m.product_id
    WHERE l.id = lesson_files.lesson_id AND p.producer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lessons l
    JOIN modules m ON m.id = l.module_id
    JOIN products p ON p.id = m.product_id
    WHERE l.id = lesson_files.lesson_id AND p.producer_id = auth.uid()
  )
);

-- Students who have access can read lesson files
CREATE POLICY "Students can read accessible lesson files"
ON public.lesson_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lessons l
    WHERE l.id = lesson_files.lesson_id
    AND public.user_can_access_lesson(auth.uid(), l.module_id)
  )
);
