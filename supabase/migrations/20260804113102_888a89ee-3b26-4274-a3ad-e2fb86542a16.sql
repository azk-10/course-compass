DROP FUNCTION IF EXISTS public.my_org();

REVOKE ALL ON FUNCTION public.is_org_staff(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_staff(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_post(_session_id uuid, _label text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = _session_id AND s.status = 'live' AND s.chat_paused = false
  ) AND NOT EXISTS (
    SELECT 1 FROM public.session_blocks b
    WHERE b.session_id = _session_id
      AND b.student_label = _label
      AND (b.kind = 'remove' OR b.until IS NULL OR b.until > now())
  )
$$;