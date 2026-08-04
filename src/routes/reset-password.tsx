import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { resolveLandingRoute } from "@/lib/use-owner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Course Compass" },
      {
        name: "description",
        content:
          "Set a new Course Compass password using the secure recovery link sent to your account email.",
      },
      { property: "og:title", content: "Choose a new password — Course Compass" },
      {
        property: "og:description",
        content: "Finish recovering your Course Compass account and set a new password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(Boolean(session));
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Use at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Both passwords must match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      const to = await resolveLandingRoute("/courses");
      navigate({ to, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Compass className="size-5 text-primary" />
          Course Compass
        </Link>

        <h1 className="mt-8 font-display text-2xl font-semibold">Choose a new password</h1>

        {!ready ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking your recovery link…
          </p>
        ) : !hasSession ? (
          <div className="mt-4 space-y-4">
            <p className="rounded-lg border border-border bg-secondary p-4 text-sm">
              This recovery link is missing, expired or already used. Request a fresh one and open it
              on this device.
            </p>
            <Link
              to="/auth"
              search={{ role: "teacher" as const }}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Set a new password for your account — you'll stay signed in afterwards.
            </p>
            <div>
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="text-xs font-medium text-muted-foreground">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Update password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
