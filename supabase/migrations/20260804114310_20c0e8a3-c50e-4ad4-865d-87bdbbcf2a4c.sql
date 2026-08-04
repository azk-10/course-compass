CREATE OR REPLACE FUNCTION public.guard_profile_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owners and the service role bypass this guard entirely.
  IF auth.uid() IS NULL OR auth.uid() <> NEW.id THEN
    RETURN NEW;
  END IF;

  -- A user editing their own profile may never change their role.
  NEW.role := OLD.role;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    -- Joining or switching organizations always requires owner approval.
    IF NEW.organization_id IS NULL THEN
      NEW.approval_status := 'approved';
    ELSE
      NEW.approval_status := 'pending';
    END IF;
  ELSE
    -- No self-approval: keep whatever the owner last decided.
    NEW.approval_status := OLD.approval_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_approval ON public.profiles;
CREATE TRIGGER guard_profile_approval
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_approval();