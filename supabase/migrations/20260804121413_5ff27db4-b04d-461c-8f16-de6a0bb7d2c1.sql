CREATE INDEX IF NOT EXISTS messages_session_created_idx ON public.messages (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_session_sender_created_idx ON public.messages (session_id, sender_label, created_at DESC);
CREATE INDEX IF NOT EXISTS threads_session_activity_idx ON public.threads (session_id, last_activity_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_message_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cooldown int := 1500;
  burst_count int;
  last_at timestamptz;
BEGIN
  IF NEW.is_teacher THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(cs.cooldown_ms, 1500) INTO cooldown
  FROM public.sessions s
  LEFT JOIN public.classroom_settings cs ON cs.teacher_id = s.teacher_id
  WHERE s.id = NEW.session_id
  LIMIT 1;

  cooldown := GREATEST(COALESCE(cooldown, 1500), 250);

  SELECT max(m.created_at) INTO last_at
  FROM public.messages m
  WHERE m.session_id = NEW.session_id
    AND m.sender_label = NEW.sender_label
    AND m.is_teacher = false
    AND m.created_at > now() - (cooldown || ' milliseconds')::interval;

  IF last_at IS NOT NULL THEN
    RAISE EXCEPTION 'RATE_LIMIT: slow down, wait a moment before sending again'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO burst_count
  FROM public.messages m
  WHERE m.session_id = NEW.session_id
    AND m.sender_label = NEW.sender_label
    AND m.is_teacher = false
    AND m.created_at > now() - interval '1 minute';

  IF burst_count >= 30 THEN
    RAISE EXCEPTION 'RATE_LIMIT_BURST: too many messages in the last minute'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_message_rate ON public.messages;
CREATE TRIGGER enforce_message_rate
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate();