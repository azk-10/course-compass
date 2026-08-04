
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO authenticated, service_role;
