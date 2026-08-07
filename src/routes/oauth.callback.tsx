import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Compass, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { pageMeta } from "@/lib/seo";
import { resolveLandingRoute } from "@/lib/use-owner";
import { logAuthError, logAuthEvent } from "@/lib/auth-log";

export const Route = createFileRoute("/oauth/callback")({
  head: () =>
    pageMeta({
      title: "Signing you in",
      description: "Finishing your Course Compass sign-in.",
      path: "/oauth/callback",
      noindex: true,
    }),
  component: OAuthCallback,
});

/**
 * Public landing page for social sign-in.
 *
 * The provider must return to a public same-origin URL, so it cannot point at a
 * protected route. This page waits for the Supabase session to hydrate and then
 * sends the account to the home route its database role earns it — which is why
 * Google sign-in behaves identically on preview and on production.
 */
function OAuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let settled = false;

    const providerError = new URLSearchParams(window.location.search).get("error");
    if (providerError) {
      logAuthError("google-oauth", { message: providerError });
      setFailed("Your provider cancelled the sign-in. Please try again.");
      return;
    }

    const land = async () => {
      if (settled || !active) return;
      settled = true;
      logAuthEvent("google-oauth", { completed: true });
      await navigate({ to: await resolveLandingRoute("/courses"), replace: true });
    };

    // The session may already be stored, or may arrive moments later.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void land();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase holds an internal lock during this callback — defer the work.
      if (session) window.setTimeout(() => void land(), 0);
    });

    const timer = window.setTimeout(() => {
      if (!settled && active) {
        setFailed("We couldn't finish the sign-in. Please try again.");
      }
    }, 10_000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <Compass className="mx-auto size-6 text-primary" aria-hidden="true" />
        {failed ? (
          <>
            <h1 className="mt-4 font-display text-xl font-semibold">Sign-in didn't finish</h1>
            <p className="mt-2 text-sm text-muted-foreground">{failed}</p>
            <Link
              to="/auth"
              search={{ role: "teacher" as const }}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mt-6 size-5 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Signing you in…</p>
          </>
        )}
      </div>
    </main>
  );
}
