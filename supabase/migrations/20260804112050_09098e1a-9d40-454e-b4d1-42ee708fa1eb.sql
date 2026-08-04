
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.organizations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can search organizations"
  ON public.organizations FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "owners manage their organization"
  ON public.organizations FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

ALTER TABLE public.profiles
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN email text;

CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org_id AND o.owner_id = _user_id
  )
$$;

CREATE POLICY "org owners read member profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id));

CREATE POLICY "org owners update member profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_org_owner(auth.uid(), organization_id))
  WITH CHECK (public.is_org_owner(auth.uid(), organization_id));

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role text := COALESCE(NEW.raw_user_meta_data->>'role', 'teacher');
  org_name text := NULLIF(NEW.raw_user_meta_data->>'organization_name', '');
  org_id uuid := NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;
  status text := 'approved';
BEGIN
  IF new_role = 'owner' AND org_name IS NOT NULL THEN
    INSERT INTO public.organizations (name, owner_id)
    VALUES (org_name, NEW.id)
    RETURNING id INTO org_id;
  ELSIF new_role = 'teacher' AND org_id IS NOT NULL THEN
    status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, display_name, role, organization_id, approval_status, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    new_role,
    org_id,
    status,
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  IF new_role <> 'student' AND status = 'approved' THEN
    INSERT INTO public.courses (teacher_id, title, term, accent)
    VALUES (NEW.id, 'Physics Crash Course 2026', 'Live', 'amber');
  END IF;

  RETURN NEW;
END;
$$;
