ALTER TABLE public.courses
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  ADD COLUMN is_crash boolean NOT NULL DEFAULT false,
  ADD COLUMN archived_at timestamp with time zone;

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_label text NOT NULL CHECK (char_length(student_label) BETWEEN 1 AND 60),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_label)
);

GRANT SELECT, INSERT ON public.enrollments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers manage own enrollments"
ON public.enrollments FOR ALL
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "students request to join an active course"
ON public.enrollments FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = enrollments.course_id
      AND c.status = 'active'
      AND c.teacher_id = enrollments.teacher_id
  )
);

CREATE POLICY "students can check enrollment status"
ON public.enrollments FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_enrollments_updated_at
BEFORE UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;