import { supabase } from "@/integrations/supabase/client";

export type Organization = { id: string; name: string; owner_id: string };

export type TeacherProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  approval_status: string;
  organization_id: string | null;
  created_at: string;
};

const PROFILE_FIELDS =
  "id, display_name, email, role, approval_status, organization_id, created_at";

/** Search organizations by name — used before a teacher has an account. */
export async function searchOrganizations(term: string): Promise<Organization[]> {
  let query = supabase.from("organizations").select("id, name, owner_id").order("name").limit(20);
  const trimmed = term.trim();
  if (trimmed) query = query.ilike("name", `%${trimmed}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** The signed-in user's own profile (role, organization, approval state). */
export async function fetchMyProfile(): Promise<TeacherProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const id = auth.user?.id;
  if (!id) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as TeacherProfile) ?? null;
}

/** The organization owned by the signed-in user, if any. */
export async function fetchOwnedOrganization(): Promise<Organization | null> {
  const { data: auth } = await supabase.auth.getUser();
  const id = auth.user?.id;
  if (!id) return null;
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, owner_id")
    .eq("owner_id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Every teacher attached to an organization, newest requests first. */
export async function fetchOrgTeachers(orgId: string): Promise<TeacherProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TeacherProfile[];
}

/** Owner decision on a teacher request. */
export async function setTeacherApproval(teacherId: string, status: "approved" | "rejected") {
  const { error } = await supabase
    .from("profiles")
    .update({ approval_status: status })
    .eq("id", teacherId);
  if (error) throw error;
}

/** A single organization by id — used to name the pending-approval screen. */
export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, owner_id")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Attach the signed-in teacher to an organization. A database trigger forces
 * the account back into `pending`, so only the owner can approve it.
 */
export async function requestOrganizationJoin(orgId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const id = auth.user?.id;
  if (!id) throw new Error("Not signed in");
  const { error } = await supabase.from("profiles").update({ organization_id: orgId }).eq("id", id);
  if (error) throw error;
}

/** Withdraw the request and continue as an independent teacher. */
export async function leaveOrganization() {
  const { data: auth } = await supabase.auth.getUser();
  const id = auth.user?.id;
  if (!id) throw new Error("Not signed in");
  const { error } = await supabase.from("profiles").update({ organization_id: null }).eq("id", id);
  if (error) throw error;
}

export type ApprovalEvent = {
  id: string;
  teacher_id: string;
  teacher_name: string | null;
  teacher_email: string | null;
  action: "requested" | "approved" | "rejected" | "withdrawn";
  actor_id: string | null;
  created_at: string;
};

/** Immutable audit trail of join requests and owner decisions for an organization. */
export async function fetchApprovalEvents(orgId: string, limit = 100): Promise<ApprovalEvent[]> {
  const { data, error } = await supabase
    .from("org_approval_events")
    .select("id, teacher_id, teacher_name, teacher_email, action, actor_id, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ApprovalEvent[];
}
