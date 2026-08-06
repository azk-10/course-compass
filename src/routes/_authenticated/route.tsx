import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { logAuthError } from "@/lib/auth-log";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // A misconfigured/unreachable backend must send the user to /auth, never crash the route.
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        if (error) logAuthError("route-guard", error);
        throw redirect({ to: "/auth", search: { role: "teacher" } });
      }
      return { user: data.user };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      logAuthError("route-guard", error);
      throw redirect({ to: "/auth", search: { role: "teacher" } });
    }
  },
  component: () => <Outlet />,
});
