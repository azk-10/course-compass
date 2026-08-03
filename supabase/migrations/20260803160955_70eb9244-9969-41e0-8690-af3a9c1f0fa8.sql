CREATE OR REPLACE FUNCTION public.is_live_session(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = _session_id AND status = 'live'
  )
$$;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_label text NOT NULL,
  is_teacher boolean NOT NULL DEFAULT false,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX messages_session_created_idx ON public.messages (session_id, created_at);

GRANT SELECT, INSERT ON public.messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read messages of live sessions"
ON public.messages FOR SELECT
TO anon, authenticated
USING (public.is_live_session(session_id));

CREATE POLICY "post messages to live sessions"
ON public.messages FOR INSERT
TO anon, authenticated
WITH CHECK (public.is_live_session(session_id));

CREATE POLICY "teachers manage own session messages"
ON public.messages FOR ALL
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

-- students need to discover live sessions
CREATE POLICY "anyone can see live sessions"
ON public.sessions FOR SELECT
TO anon, authenticated
USING (status = 'live');

-- and the course title of a live session
CREATE POLICY "anyone can see courses with a live session"
ON public.courses FOR SELECT
TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.course_id = courses.id AND s.status = 'live'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;