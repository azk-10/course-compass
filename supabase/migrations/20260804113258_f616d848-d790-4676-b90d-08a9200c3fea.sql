-- ======== helpers ========
CREATE OR REPLACE FUNCTION public.is_session_teacher(_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = _session AND s.teacher_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_session_student(_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions s
    JOIN public.enrollments e ON e.course_id = s.course_id
    WHERE s.id = _session
      AND s.status = 'live'
      AND e.student_user_id = auth.uid()
      AND e.status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.in_session(_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_session_teacher(_session) OR public.is_session_student(_session)
$$;

CREATE OR REPLACE FUNCTION public.can_post(_session_id uuid, _label text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.in_session(_session_id)
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = _session_id AND s.status = 'live' AND s.chat_paused = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.session_blocks b
      WHERE b.session_id = _session_id
        AND b.student_label = _label
        AND (b.kind = 'remove' OR b.until IS NULL OR b.until > now())
    )
$$;

REVOKE ALL ON FUNCTION public.is_session_teacher(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_session_student(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.in_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_post(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_session_teacher(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_session_student(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.in_session(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_post(uuid, text) TO authenticated, service_role;

-- ======== courses ========
DROP POLICY IF EXISTS "anyone can see active courses" ON public.courses;
CREATE POLICY "enrolled students see their courses" ON public.courses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = courses.id AND e.student_user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.course_by_code(_code text)
RETURNS TABLE (id uuid, title text, term text, is_crash boolean, teacher_id uuid, join_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.title, c.term, c.is_crash, c.teacher_id, c.join_code
  FROM public.courses c
  WHERE c.join_code = upper(trim(_code)) AND c.status = 'active'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.course_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.course_by_code(text) TO authenticated, service_role;

-- ======== enrollments ========
DROP POLICY IF EXISTS "students can check enrollment status" ON public.enrollments;
DROP POLICY IF EXISTS "anonymous students request to join an active course" ON public.enrollments;
CREATE POLICY "students read own enrollments" ON public.enrollments
  FOR SELECT TO authenticated USING (student_user_id = auth.uid());

-- ======== sessions ========
DROP POLICY IF EXISTS "anyone can see sessions of active courses" ON public.sessions;
CREATE POLICY "enrolled students see live sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = sessions.course_id
      AND e.student_user_id = auth.uid()
      AND e.status = 'approved'
  ));

-- ======== messages ========
DROP POLICY IF EXISTS "read messages of live sessions" ON public.messages;
DROP POLICY IF EXISTS "post messages to live sessions" ON public.messages;
DROP POLICY IF EXISTS "move own messages in live sessions" ON public.messages;
CREATE POLICY "read messages in my session" ON public.messages
  FOR SELECT TO authenticated USING (public.in_session(session_id));
CREATE POLICY "post messages to my live session" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (public.can_post(session_id, sender_label));
CREATE POLICY "move own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (is_teacher = false AND public.is_session_student(session_id) AND student_id = auth.uid())
  WITH CHECK (is_teacher = false AND public.is_session_student(session_id) AND student_id = auth.uid());

-- ======== threads and their side tables ========
DROP POLICY IF EXISTS "read threads of live sessions" ON public.threads;
DROP POLICY IF EXISTS "create threads in live sessions" ON public.threads;
DROP POLICY IF EXISTS "update threads of live sessions" ON public.threads;
CREATE POLICY "read threads in my session" ON public.threads
  FOR SELECT TO authenticated USING (public.in_session(session_id));
CREATE POLICY "create threads in my live session" ON public.threads
  FOR INSERT TO authenticated WITH CHECK (public.is_session_student(session_id));
CREATE POLICY "update threads in my live session" ON public.threads
  FOR UPDATE TO authenticated
  USING (public.is_session_student(session_id))
  WITH CHECK (public.is_session_student(session_id));

DROP POLICY IF EXISTS "read participants of live sessions" ON public.thread_participants;
DROP POLICY IF EXISTS "join threads of live sessions" ON public.thread_participants;
DROP POLICY IF EXISTS "leave threads of live sessions" ON public.thread_participants;
CREATE POLICY "read participants in my session" ON public.thread_participants
  FOR SELECT TO authenticated USING (public.in_session(session_id));
CREATE POLICY "join threads in my live session" ON public.thread_participants
  FOR INSERT TO authenticated WITH CHECK (public.can_post(session_id, student_label));
CREATE POLICY "leave threads in my live session" ON public.thread_participants
  FOR DELETE TO authenticated USING (public.is_session_student(session_id));

DROP POLICY IF EXISTS "read votes of live sessions" ON public.thread_votes;
DROP POLICY IF EXISTS "vote in live sessions" ON public.thread_votes;
DROP POLICY IF EXISTS "remove vote in live sessions" ON public.thread_votes;
CREATE POLICY "read votes in my session" ON public.thread_votes
  FOR SELECT TO authenticated USING (public.in_session(session_id));
CREATE POLICY "vote in my live session" ON public.thread_votes
  FOR INSERT TO authenticated WITH CHECK (public.can_post(session_id, student_label));
CREATE POLICY "remove my vote" ON public.thread_votes
  FOR DELETE TO authenticated USING (public.is_session_student(session_id));

DROP POLICY IF EXISTS "read feedback of live sessions" ON public.thread_feedback;
DROP POLICY IF EXISTS "give feedback in live sessions" ON public.thread_feedback;
DROP POLICY IF EXISTS "change feedback in live sessions" ON public.thread_feedback;
DROP POLICY IF EXISTS "clear feedback in live sessions" ON public.thread_feedback;
CREATE POLICY "read feedback in my session" ON public.thread_feedback
  FOR SELECT TO authenticated USING (public.in_session(session_id));
CREATE POLICY "give feedback in my live session" ON public.thread_feedback
  FOR INSERT TO authenticated WITH CHECK (public.can_post(session_id, student_label));
CREATE POLICY "change my feedback" ON public.thread_feedback
  FOR UPDATE TO authenticated
  USING (public.is_session_student(session_id)) WITH CHECK (public.is_session_student(session_id));
CREATE POLICY "clear my feedback" ON public.thread_feedback
  FOR DELETE TO authenticated USING (public.is_session_student(session_id));

-- ======== polls ========
DROP POLICY IF EXISTS "read polls of live sessions" ON public.polls;
DROP POLICY IF EXISTS "create polls in live sessions" ON public.polls;
CREATE POLICY "read polls in my session" ON public.polls
  FOR SELECT TO authenticated USING (public.in_session(session_id));
CREATE POLICY "create polls in my live session" ON public.polls
  FOR INSERT TO authenticated WITH CHECK (public.in_session(session_id));

DROP POLICY IF EXISTS "read poll responses of live sessions" ON public.poll_responses;
DROP POLICY IF EXISTS "answer polls in live sessions" ON public.poll_responses;
CREATE POLICY "read poll responses in my session" ON public.poll_responses
  FOR SELECT TO authenticated USING (public.in_session(session_id));
CREATE POLICY "answer polls in my live session" ON public.poll_responses
  FOR INSERT TO authenticated WITH CHECK (public.can_post(session_id, student_label));

-- ======== reactions and blocks ========
DROP POLICY IF EXISTS "read reactions of live sessions" ON public.session_reactions;
DROP POLICY IF EXISTS "react in live sessions" ON public.session_reactions;
DROP POLICY IF EXISTS "change own reaction" ON public.session_reactions;
DROP POLICY IF EXISTS "clear reactions in live sessions" ON public.session_reactions;
CREATE POLICY "read reactions in my session" ON public.session_reactions
  FOR SELECT TO authenticated USING (public.in_session(session_id));
CREATE POLICY "react in my live session" ON public.session_reactions
  FOR INSERT TO authenticated WITH CHECK (public.can_post(session_id, student_label));
CREATE POLICY "change my reaction" ON public.session_reactions
  FOR UPDATE TO authenticated
  USING (public.can_post(session_id, student_label))
  WITH CHECK (public.can_post(session_id, student_label));
CREATE POLICY "clear reactions" ON public.session_reactions
  FOR DELETE TO authenticated
  USING (public.is_session_teacher(session_id) OR public.is_session_student(session_id));

DROP POLICY IF EXISTS "read blocks of live sessions" ON public.session_blocks;
CREATE POLICY "read blocks in my session" ON public.session_blocks
  FOR SELECT TO authenticated USING (public.in_session(session_id));

-- ======== settings and logs ========
DROP POLICY IF EXISTS "read settings" ON public.classroom_settings;
CREATE POLICY "signed in users read settings" ON public.classroom_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "write logs" ON public.activity_logs;
CREATE POLICY "signed in users write logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

REVOKE ALL ON public.classroom_settings FROM anon;
REVOKE ALL ON public.session_blocks FROM anon;
REVOKE ALL ON public.session_reactions FROM anon;
REVOKE ALL ON public.activity_logs FROM anon;