import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AccessRole = {
  userId: string | null;
  /** Platform owner — the only role that may open the owner console. */
  isOwner: boolean;
  /** Staff role that may open internal admin pages (owner counts as admin). */
  isAdmin: boolean;
  /** Account role from the profiles table: teacher | student | owner. */
  profileRole: string | null;
};

const SIGNED_OUT: AccessRole = {
  userId: null,
  isOwner: false,
  isAdmin: false,
  profileRole: null,
};

/**
 * Single source of truth for "who is this and what may they open".
 * Roles come from the database (`user_roles` for platform staff, `profiles.role`
 * for the account type) — never from hardcoded emails or client-side storage.
 */
export async function fetchAccessRole(): Promise<AccessRole> {
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return SIGNED_OUT;

  const [roles, profile] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
    supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
  ]);

  const held = new Set((roles.data ?? []).map((row) => row.role));
  return {
    userId: auth.user.id,
    isOwner: held.has("owner"),
    isAdmin: held.has("owner") || held.has("admin"),
    profileRole: profile.data?.role ?? null,
  };
}

/** True when the signed-in account holds the platform `owner` role. */
export function useIsPlatformOwner() {
  return useQuery({
    queryKey: ["platform-owner"],
    staleTime: 60_000,
    queryFn: async () => (await fetchAccessRole()).isOwner,
  });
}

/** True when the signed-in account may open internal admin pages. */
export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: ["platform-admin"],
    staleTime: 60_000,
    queryFn: async () => (await fetchAccessRole()).isAdmin,
  });
}

/** The home route for an account, decided by its database role. */
export function homeRouteFor(access: AccessRole, fallback = "/courses"): string {
  if (!access.userId) return fallback;
  if (access.isOwner) return "/owner";
  if (access.profileRole === "student") return "/student";
  return fallback;
}

/**
 * Resolves the post-login landing route for the current session. Used after
 * sign-in, sign-up, password reset and OAuth so every entry point agrees.
 */
export async function resolveLandingRoute(fallback: string): Promise<string> {
  try {
    return homeRouteFor(await fetchAccessRole(), fallback);
  } catch {
    return fallback;
  }
}
