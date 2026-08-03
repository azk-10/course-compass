ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS confidence numeric NOT NULL DEFAULT 1;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'question';

CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.threads(id) ON DELETE CASCADE,
  kind text NOT NULL,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS polls_unique_per_session
  ON public.polls (session_id, kind, thread_id) NULLS NOT DISTINCT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT SELECT, INSERT ON public.polls TO anon;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read polls of live sessions" ON public.polls FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = polls.session_id AND s.status = 'live'));
CREATE POLICY "create polls in live sessions" ON public.polls FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = polls.session_id AND s.status = 'live'));
CREATE POLICY "teachers manage polls" ON public.polls FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = polls.session_id AND s.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = polls.session_id AND s.teacher_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_label text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, student_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_responses TO authenticated;
GRANT SELECT, INSERT ON public.poll_responses TO anon;
GRANT ALL ON public.poll_responses TO service_role;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read poll responses of live sessions" ON public.poll_responses FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = poll_responses.session_id AND s.status = 'live'));
CREATE POLICY "answer polls in live sessions" ON public.poll_responses FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = poll_responses.session_id AND s.status = 'live'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_responses;