import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** True when the signed-in account holds the platform `owner` role. */
export function useIsPlatformOwner() {
  return useQuery({
    queryKey: ["platform-owner"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id)
        .eq("role", "owner")
        .maybeSingle();
      return Boolean(data);
    },
  });
}

/** Resolves the post-login landing route for the current session. */
export async function resolveLandingRoute(fallback: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fallback;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "owner")
    .maybeSingle();
  return data ? "/owner" : fallback;
}
