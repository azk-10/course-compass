import { createFileRoute, isRedirect, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { logAuthError } from "@/lib/auth-log";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // A misconfigured/unreachable backend must send the user to /auth, never crash the route.
    try {
      const { data, error } = await supabase.auth.getUser();
      // "no session" is the normal signed-out path, not an incident to log.
      if (error || !data.user) throw redirect({ to: "/auth", search: { role: "teacher" } });
      return { user: data.user };
    } catch (error) {
      // Redirects travel as thrown values — never log or swallow them.
      if (isRedirect(error) || error instanceof Response) throw error;
      // A missing session is the ordinary signed-out case, not a failure.
      const name = (error as { name?: string } | null)?.name;
      if (name !== "AuthSessionMissingError") logAuthError("route-guard", error);

      throw redirect({ to: "/auth", search: { role: "teacher" } });
    }
  },

  component: () => <Outlet />,
});
