import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Check, Compass, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { OrganizationPicker } from "@/components/org/OrganizationPicker";
import type { Organization } from "@/lib/org";

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
  const [mode, setMode] = useState<"signin" | "signup">(isOwner ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [org, setOrg] = useState<Organization | null>(null);
  const [independent, setIndependent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const needsOrgPicker = role === "teacher" && mode === "signup";

  useEffect(() => {
    const go = () => navigate({ to: isStudent ? "/student" : "/courses", replace: true });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, isStudent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsOrgPicker && !org && !independent) {
      toast.error("Pick your organization, or continue as an independent teacher");
      return;
    }

    if (isOwner && mode === "signup" && !orgName.trim()) {
      toast.error("Give your organization a name");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              role,
              ...(isOwner ? { organization_name: orgName.trim() } : {}),
              ...(org ? { organization_id: org.id } : {}),
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
    }
  }

  const heading =
    mode === "signin"
      ? "Welcome back"
      : isStudent
        ? "Create your student account"
        : isOwner
          ? "Register your organization"
          : "Create your teacher account";

  const sub =
    mode === "signin"
      ? isStudent
        ? "Sign in to reach your classes."
        : "Sign in to open your courses."
      : isStudent
        ? "Sign in once — then enrol with your teacher's course code."
        : isOwner
          ? "You will own the organization and approve every teacher who joins it."
          : "Search for your school, college or academy — its owner approves you. Not part of one? Join as an independent teacher.";

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
            Group your questions, launch a live session in one tap and watch participation,
            accuracy and pace update as students answer.
          </p>
        </div>
        <p className="text-xs opacity-60">Built for lecturers, tutors and lab instructors.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold">{heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>

          {mode === "signin" && (
            <button
              onClick={handleGoogle}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Continue with Google
            </button>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {mode === "signin" ? "or use email" : "use email"}
            <span className="h-px flex-1 bg-border" />
          </div>

          {sent ? (
            <p className="rounded-lg border border-border bg-secondary p-4 text-sm">
              Confirmation email sent to <strong>{email}</strong>. Click the link to finish
              setting up your account.
              {needsOrgPicker && " Your organization owner then approves you."}
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
                  <label className="text-xs font-medium text-muted-foreground">
                    Your organization
                  </label>
                  <div className="mt-1">
                    <OrganizationPicker
                      value={org}
                      onSelect={(next) => {
                        setOrg(next);
                        if (next) setIndependent(false);
                      }}
                      independent={independent}
                      onIndependent={(next) => {
                        setIndependent(next);
                        if (next) setOrg(null);
                      }}
                    />
                  </div>
                  {org && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      The owner of {org.name} reviews your request before your courses unlock.
                    </p>
                  )}
                  {independent && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Independent teachers get full access straight away — no approval needed.
                    </p>
                  )}
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
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : isOwner ? "Register organization" : "Create account"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
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
