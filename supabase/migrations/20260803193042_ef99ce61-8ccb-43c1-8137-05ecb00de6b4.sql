-- Sessions become named, mode-driven live sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Live session',
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'question',
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid,
  ADD COLUMN IF NOT EXISTS quiz_prompt text,
  ADD COLUMN IF NOT EXISTS quiz_answer_type text,
  ADD COLUMN IF NOT EXISTS quiz_options jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Only one live session per teacher at a time
CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_live_per_teacher
  ON public.sessions (teacher_id) WHERE status = 'live';

-- Messages: every message belongs to a course, session, student, time and type
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS student_id uuid,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'chat';

UPDATE public.messages m
SET course_id = s.course_id
FROM public.sessions s
WHERE m.session_id = s.id AND m.course_id IS NULL;

CREATE INDEX IF NOT EXISTS messages_session_created_idx
  ON public.messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS messages_course_idx ON public.messages (course_id);

-- Drop LMS-style structures (assignments/questions/grading)
DROP TABLE IF EXISTS public.responses;
DROP TABLE IF EXISTS public.questions;
DROP TABLE IF EXISTS public.question_groups;

-- Reseed trigger: a sample course only, no question banks
CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.courses (teacher_id, title, term, accent)
  VALUES (NEW.id, 'Physics Crash Course 2026', 'Live', 'amber');

  RETURN NEW;
END;
$function$;

-- Teachers can delete a course together with its students and messages
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_course_id_fkey,
  ADD CONSTRAINT enrollments_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_course_id_fkey,
  ADD CONSTRAINT sessions_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_session_id_fkey,
  ADD CONSTRAINT messages_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Approved students of a course may read its session list (to auto-join)
DROP POLICY IF EXISTS "anyone can see live sessions" ON public.sessions;
CREATE POLICY "anyone can see sessions of active courses"
  ON public.sessions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = sessions.course_id AND c.status = 'active'));