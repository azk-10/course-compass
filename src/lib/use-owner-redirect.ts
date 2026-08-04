import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * When an already signed-in platform owner lands on a public page, send them
 * straight to the owner console instead of making them sign in again.
 */
export function useOwnerAutoRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!active || !auth.user) return;
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", auth.user.id)
          .eq("role", "owner")
          .maybeSingle();
        if (active && data) navigate({ to: "/owner", replace: true });
      } catch {
        // Never block the public page on an auth/network hiccup.
      }
    }

    void check();
    return () => {
      active = false;
    };
  }, [navigate]);
}
