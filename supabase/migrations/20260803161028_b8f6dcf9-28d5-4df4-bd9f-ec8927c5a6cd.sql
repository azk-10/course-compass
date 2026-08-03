DROP POLICY "read messages of live sessions" ON public.messages;
DROP POLICY "post messages to live sessions" ON public.messages;

CREATE POLICY "read messages of live sessions"
ON public.messages FOR SELECT
TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = messages.session_id AND s.status = 'live'));

CREATE POLICY "post messages to live sessions"
ON public.messages FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = messages.session_id AND s.status = 'live'));

DROP FUNCTION IF EXISTS public.is_live_session(uuid);