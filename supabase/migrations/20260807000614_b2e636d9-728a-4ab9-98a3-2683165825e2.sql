CREATE OR REPLACE FUNCTION public.is_approved_teacher(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.approval_status = 'approved'
      AND COALESCE(p.account_status, 'active') = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_role text := COALESCE(NEW.raw_user_meta_data->>'role', 'teacher');
  org_name text := NULLIF(trim(NEW.raw_user_meta_data->>'organization_name'), '');
  org_id uuid := NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;
  status text := 'approved';
BEGIN
  IF new_role = 'owner' AND org_name IS NOT NULL THEN
    INSERT INTO public.organizations (name, owner_id)
    VALUES (org_name, NEW.id)
    RETURNING id INTO org_id;
  ELSIF new_role = 'teacher' THEN
    IF org_id IS NULL AND org_name IS NOT NULL THEN
      SELECT o.id INTO org_id FROM public.organizations o
      WHERE lower(o.name) = lower(org_name) LIMIT 1;
    END IF;
    -- Every teacher account waits for approval, organization or not.
    status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, display_name, role, organization_id, organization_name, approval_status, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    new_role,
    org_id,
    org_name,
    status,
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "own courses" ON public.courses;
CREATE POLICY "read own courses" ON public.courses FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "approved teachers create courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id AND public.is_approved_teacher(auth.uid()));
CREATE POLICY "update own courses" ON public.courses FOR UPDATE TO authenticated USING (auth.uid() = teacher_id AND public.is_approved_teacher(auth.uid())) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "delete own courses" ON public.courses FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "own sessions" ON public.sessions;
CREATE POLICY "read own sessions" ON public.sessions FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "approved teachers create sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id AND public.is_approved_teacher(auth.uid()));
CREATE POLICY "update own sessions" ON public.sessions FOR UPDATE TO authenticated USING (auth.uid() = teacher_id AND public.is_approved_teacher(auth.uid())) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "delete own sessions" ON public.sessions FOR DELETE TO authenticated USING (auth.uid() = teacher_id);