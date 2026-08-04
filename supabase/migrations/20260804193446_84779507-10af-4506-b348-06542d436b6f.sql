ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_name text;

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF org_id IS NOT NULL OR org_name IS NOT NULL THEN
      status := 'pending';
    END IF;
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

  IF new_role <> 'student' AND status = 'approved' THEN
    INSERT INTO public.courses (teacher_id, title, term, accent)
    VALUES (NEW.id, 'Physics Crash Course 2026', 'Live', 'amber');
  END IF;

  RETURN NEW;
END;
$function$;