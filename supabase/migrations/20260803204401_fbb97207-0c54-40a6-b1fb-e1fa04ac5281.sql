
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS resolve_threshold integer NOT NULL DEFAULT 75;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thread_id uuid;

CREATE TABLE public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id uuid,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.threads TO anon;
GRANT ALL ON public.threads TO service_role;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read threads of live sessions" ON public.threads FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = threads.session_id AND s.status = 'live'));
CREATE POLICY "create threads in live sessions" ON public.threads FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = threads.session_id AND s.status = 'live'));
CREATE POLICY "update threads of live sessions" ON public.threads FOR UPDATE TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = threads.session_id AND s.status = 'live'));
CREATE POLICY "teachers manage own threads" ON public.threads FOR ALL TO authenticated
USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

ALTER TABLE public.messages ADD CONSTRAINT messages_thread_id_fkey
  FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE SET NULL;

CREATE TABLE public.thread_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, student_label)
);

CREATE TABLE public.thread_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, student_label)
);

CREATE TABLE public.thread_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_label text NOT NULL,
  state text NOT NULL DEFAULT 'resolved',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, student_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_participants TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_votes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_feedback TO authenticated, anon;
GRANT ALL ON public.thread_participants TO service_role;
GRANT ALL ON public.thread_votes TO service_role;
GRANT ALL ON public.thread_feedback TO service_role;

ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read participants of live sessions" ON public.thread_participants FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_participants.session_id AND s.status = 'live'));
CREATE POLICY "join threads of live sessions" ON public.thread_participants FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_participants.session_id AND s.status = 'live'));
CREATE POLICY "leave threads of live sessions" ON public.thread_participants FOR DELETE TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_participants.session_id AND s.status = 'live'));

CREATE POLICY "read votes of live sessions" ON public.thread_votes FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_votes.session_id AND s.status = 'live'));
CREATE POLICY "vote in live sessions" ON public.thread_votes FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_votes.session_id AND s.status = 'live'));
CREATE POLICY "remove vote in live sessions" ON public.thread_votes FOR DELETE TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_votes.session_id AND s.status = 'live'));

CREATE POLICY "read feedback of live sessions" ON public.thread_feedback FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_feedback.session_id AND s.status = 'live'));
CREATE POLICY "give feedback in live sessions" ON public.thread_feedback FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_feedback.session_id AND s.status = 'live'));
CREATE POLICY "change feedback in live sessions" ON public.thread_feedback FOR UPDATE TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_feedback.session_id AND s.status = 'live'));
CREATE POLICY "clear feedback in live sessions" ON public.thread_feedback FOR DELETE TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = thread_feedback.session_id AND s.status = 'live'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_feedback;
