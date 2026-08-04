CREATE TABLE public.org_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  teacher_name text,
  teacher_email text,
  action text NOT NULL CHECK (action IN ('requested','approved','rejected','withdrawn')),
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_approval_events_org_idx ON public.org_approval_events (organization_id, created_at DESC);

GRANT SELECT ON public.org_approval_events TO authenticated;
GRANT ALL ON public.org_approval_events TO service_role;

ALTER TABLE public.org_approval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org staff read approval history"
ON public.org_approval_events FOR SELECT TO authenticated
USING (public.is_org_owner(auth.uid(), organization_id) OR public.is_org_staff(auth.uid(), organization_id));

CREATE OR REPLACE FUNCTION public.log_org_approval_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.organization_id IS NOT NULL AND NEW.role <> 'owner' THEN
      INSERT INTO public.org_approval_events (organization_id, teacher_id, teacher_name, teacher_email, action, actor_id)
      VALUES (NEW.organization_id, NEW.id, NEW.display_name, NEW.email,
              CASE WHEN NEW.approval_status = 'approved' THEN 'approved' ELSE 'requested' END,
              NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role <> 'owner' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF OLD.organization_id IS NOT NULL THEN
      INSERT INTO public.org_approval_events (organization_id, teacher_id, teacher_name, teacher_email, action, actor_id)
      VALUES (OLD.organization_id, NEW.id, NEW.display_name, NEW.email, 'withdrawn', auth.uid());
    END IF;
    IF NEW.organization_id IS NOT NULL THEN
      INSERT INTO public.org_approval_events (organization_id, teacher_id, teacher_name, teacher_email, action, actor_id)
      VALUES (NEW.organization_id, NEW.id, NEW.display_name, NEW.email, 'requested', auth.uid());
    END IF;
  ELSIF NEW.role <> 'owner'
    AND NEW.organization_id IS NOT NULL
    AND NEW.approval_status IS DISTINCT FROM OLD.approval_status
    AND NEW.approval_status IN ('approved','rejected') THEN
    INSERT INTO public.org_approval_events (organization_id, teacher_id, teacher_name, teacher_email, action, actor_id)
    VALUES (NEW.organization_id, NEW.id, NEW.display_name, NEW.email, NEW.approval_status, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_org_approval_audit
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_org_approval_event();