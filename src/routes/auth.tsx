import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Compass, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { resolveLandingRoute } from "@/lib/use-owner";
import { lovable } from "@/integrations/lovable/index";
import { authErrorMessage, logAuthError, logAuthEvent } from "@/lib/auth-log";
import { safeSupabase } from "@/lib/env";

type Role = "teacher" | "student" | "owner";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    role: (["student", "owner"].includes(search["role"] as string)
      ? (search["role"] as Role)
      : "teacher") as Role,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Course Compass" },
      {
        name: "description",
        content:
          "Sign in to Course Compass. Organizations approve their teachers, teachers run live sessions, and students enrol with a course code.",
      },
      { property: "og:title", content: "Sign in — Course Compass" },
      {
        property: "og:description",
        content: "One account for organizations, teachers and students of very large live classes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { role } = Route.useSearch();
  const isStudent = role === "student";
  const isOwner = role === "owner";
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(isOwner ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [independent, setIndependent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const needsOrgPicker = role === "teacher" && mode === "signup";

  // Set while a fresh sign-up is being routed to the plans page, so the
  // session listener below does not steal that navigation.
  const signingUp = useRef(false);

  useEffect(() => {
    let active = true;
    const go = async () => {
      if (signingUp.current) return;
      const fallback = isStudent ? "/student" : "/courses";
      const to = await resolveLandingRoute(fallback);
      if (active) await navigate({ to, replace: true });
    };

    // Must match the protected gate, which validates with getUser(). getSession()
    // returns a cached token even when the refresh call failed, so a token the
    // server rejects would bounce /auth -> /courses -> /auth forever.
    const cleanup = safeSupabase(() => {
      supabase.auth
        .getUser()
        .then(({ data, error }) => {
          if (!error && data.user) void go();
        })
        .catch((error) => logAuthError("session-restore", error));

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        // Supabase holds an internal auth lock while this callback runs. Deferring
        // avoids deadlocking when resolveLandingRoute calls getUser/query methods.
        if (session) window.setTimeout(() => void go(), 0);
      });
      return () => sub.subscription.unsubscribe();
    }, undefined);

    return () => {
      active = false;
      cleanup?.();
    };
  }, [navigate, isStudent]);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "reset") {
      if (!email.trim()) {
        toast.error("Enter the email for your account");
        return;
      }
      setBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(true);
        toast.success("Password reset link sent.");
      } catch (err) {
        logAuthError("password-reset-request", err);
        toast.error(authErrorMessage(err, "Could not send the reset link"));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (needsOrgPicker && !orgName.trim() && !independent) {
      toast.error("Enter your organization name, or tick “I teach independently”");
      return;
    }

    if (isOwner && mode === "signup" && !orgName.trim()) {
      toast.error("Give your organization a name");
      return;
    }
    setBusy(true);
    if (mode === "signup" && !isStudent) signingUp.current = true;
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/oauth/callback`,
            data: {
              role,
              ...(orgName.trim() && !independent ? { organization_name: orgName.trim() } : {}),
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success("Check your email to confirm your account.");
          return;
        }
        // Auto-confirm is on: teacher accounts still wait for approval, so send
        // them to the subscription offers first; students go straight in.
        logAuthEvent("signup", { confirmed: true, role });
        if (isStudent) {
          await navigate({ to: await resolveLandingRoute("/student"), replace: true });
        } else {
          toast.success("Account created — it's pending approval. Pick a plan to get set up.");
          await navigate({ to: "/pricing", replace: true });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("Sign in completed without creating a session");
        logAuthEvent("signin", { role });
        const fallback = isStudent ? "/student" : "/courses";
        const to = await resolveLandingRoute(fallback);
        await navigate({ to, replace: true });
      }
    } catch (err) {
      signingUp.current = false;
      logAuthError(mode === "signup" ? "signup" : "signin", err);
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      // Must be a public same-origin URL — the callback page waits for the session
      // and then routes by database role, so preview and production behave alike.
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/oauth/callback`,
      });
      if (result.error) {
        logAuthError("google-oauth", result.error);
        toast.error(authErrorMessage(result.error, "Google sign-in failed. Please try again."));
        return;
      }
      if (result.redirected) return;
      // Tokens came back in-page (preview iframe): land the user by role.
      await navigate({ to: await resolveLandingRoute("/courses"), replace: true });
    } catch (err) {
      logAuthError("google-oauth", err);
      toast.error(authErrorMessage(err, "Google sign-in failed. Please try again."));
    }
  }


  const heading =
    mode === "reset"
      ? "Reset your password"
      : mode === "signin"
        ? "Welcome back"
        : isStudent
          ? "Create your student account"
          : isOwner
            ? "Register your organization"
            : "Create your teacher account";

  const sub =
    mode === "reset"
      ? "Enter your account email and we'll send you a secure link to set a new password."
      : mode === "signin"
        ? isStudent
          ? "Sign in to reach your classes."
          : "Sign in to open your courses."
        : isStudent
          ? "Sign in once — then enrol with your teacher's course code."
          : isOwner
            ? "You will own the organization and approve every teacher who joins it."
            : "Tell us the name of your school, college or academy — your account is approved before it unlocks.";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Compass className="size-5 text-sidebar-primary" />
          Course Compass
        </Link>
        <div className="max-w-md">
          <h1 className="font-display text-4xl leading-tight font-semibold">
            Run the room, not the slides.
          </h1>
          <p className="mt-4 text-sm/6 opacity-80">
            Group your questions, launch a live session in one tap and watch participation, accuracy
            and pace update as students answer.
          </p>
        </div>
        <p className="text-xs opacity-60">Built for lecturers, tutors and lab instructors.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold">{heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>

          {mode !== "reset" && (
            <button
              type="button"
              onClick={handleGoogle}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Continue with Google
            </button>
          )}


          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {mode === "signin" ? "or use email" : mode === "reset" ? "account email" : "use email"}
            <span className="h-px flex-1 bg-border" />
          </div>

          {sent ? (
            <p className="rounded-lg border border-border bg-secondary p-4 text-sm">
              {mode === "reset" ? (
                <>
                  Password reset link sent to <strong>{email}</strong>. Open it on this device to
                  choose a new password.
                </>
              ) : (
                <>
                  Confirmation email sent to <strong>{email}</strong>. Click the link to finish
                  setting up your account.
                </>
              )}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {isOwner && mode === "signup" && (
                <div>
                  <label htmlFor="orgName" className="text-xs font-medium text-muted-foreground">
                    Organization name
                  </label>
                  <input
                    id="orgName"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Beaconhouse College, Lahore"
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}

              {needsOrgPicker && (
                <div>
                  <label
                    htmlFor="teacherOrgName"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Name of your organization
                  </label>
                  <input
                    id="teacherOrgName"
                    value={orgName}
                    disabled={independent}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Beaconhouse College, Lahore"
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={independent}
                      onChange={(e) => {
                        setIndependent(e.target.checked);
                        if (e.target.checked) setOrgName("");
                      }}
                      className="size-3.5 accent-primary"
                    />
                    I teach independently — no organization
                  </label>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {independent
                      ? "Independent teachers are reviewed by the Course Compass team before their account unlocks."
                      : "Type your school, college or academy exactly as you call it. Your account is approved before your courses unlock."}
                  </p>
                </div>
              )}


              <div>
                <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {mode !== "reset" && (
                <div>
                  <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setSent(false);
                  }}
                  className="text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                >
                  Forgot your password?
                </button>
              )}
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "reset"
                  ? "Send reset link"
                  : mode === "signin"
                    ? "Sign in"
                    : isOwner
                      ? "Register organization"
                      : "Create account"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "reset"
              ? "Remembered it?"
              : mode === "signin"
                ? "New here?"
                : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setSent(false);
              }}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>


          {!isStudent && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Check className="size-3.5" />
              {isOwner ? (
                <>
                  Joining an existing school?{" "}
                  <Link
                    to="/auth"
                    search={{ role: "teacher" as const }}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    Sign up as a teacher
                  </Link>
                </>
              ) : (
                <>
                  Running the school?{" "}
                  <Link
                    to="/auth"
                    search={{ role: "owner" as const }}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    Register an organization
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
