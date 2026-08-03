-- 1. Course join codes
CREATE OR REPLACE FUNCTION public.generate_course_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.courses WHERE join_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS join_code text;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.courses WHERE join_code IS NULL LOOP
    UPDATE public.courses SET join_code = public.generate_course_code() WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.courses ALTER COLUMN join_code SET NOT NULL;
ALTER TABLE public.courses ALTER COLUMN join_code SET DEFAULT public.generate_course_code();
CREATE UNIQUE INDEX IF NOT EXISTS courses_join_code_key ON public.courses (join_code);

-- 2. Richer enrollments tied to student accounts
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS student_email text;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS student_phone text;

CREATE INDEX IF NOT EXISTS enrollments_student_user_id_idx ON public.enrollments (student_user_id);

DROP POLICY IF EXISTS "students request to join an active course" ON public.enrollments;

CREATE POLICY "signed in students request to join an active course"
ON public.enrollments FOR INSERT TO authenticated
WITH CHECK (
  status = 'pending'
  AND student_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = enrollments.course_id
      AND c.status = 'active'
      AND c.teacher_id = enrollments.teacher_id
  )
);

CREATE POLICY "anonymous students request to join an active course"
ON public.enrollments FOR INSERT TO anon
WITH CHECK (
  status = 'pending'
  AND student_user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = enrollments.course_id
      AND c.status = 'active'
      AND c.teacher_id = enrollments.teacher_id
  )
);

-- 3. Profiles carry the account role; students get no sample course
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'teacher';

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role text := COALESCE(NEW.raw_user_meta_data->>'role', 'teacher');
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    new_role
  )
  ON CONFLICT (id) DO NOTHING;

  IF new_role <> 'student' THEN
    INSERT INTO public.courses (teacher_id, title, term, accent)
    VALUES (NEW.id, 'Physics Crash Course 2026', 'Live', 'amber');
  END IF;

  RETURN NEW;
END;
$$;