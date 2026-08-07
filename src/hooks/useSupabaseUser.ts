import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { logAuthError, logGetUserProbe } from "@/lib/auth-log";

/**
 * Single place that restores and tracks the Supabase session in the browser.
 * Pages should use this instead of wiring their own getUser + onAuthStateChange
 * pair, so there is exactly one initialization path per page.
 */
export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (error && error.name !== "AuthSessionMissingError") {
          logAuthError("session-restore", error);
        }
        setUser(data.user ?? null);
        setReady(true);
      })
      .catch((error) => {
        logAuthError("session-restore", error);
        if (active) setReady(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase holds an internal lock during this callback — defer state work.
      window.setTimeout(() => {
        if (!active) return;
        setUser(session?.user ?? null);
        setReady(true);
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, ready };
}
