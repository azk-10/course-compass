CREATE POLICY "move own messages in live sessions"
ON public.messages
FOR UPDATE
TO anon, authenticated
USING (
  is_teacher = false
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = messages.session_id AND s.status = 'live'
  )
)
WITH CHECK (
  is_teacher = false
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = messages.session_id AND s.status = 'live'
  )
);