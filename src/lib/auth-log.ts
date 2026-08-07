/**
 * Structured logging for authentication failures.
 *
 * Auth bugs usually only reproduce on a real deployment, so every failure path
 * logs the stage, the deployment origin, and whether the browser bundle even
 * received its Supabase build variables. Never logs tokens, passwords or emails.
 */
import { isSupabaseConfigured, missingClientEnv } from "@/lib/env";

export type AuthStage =
  | "signin"
  | "signup"
  | "google-oauth"
  | "password-reset-request"
  | "password-update"
  | "session-restore"
  | "route-guard";

function context() {
  return {
    origin: typeof window === "undefined" ? "server" : window.location.origin,
    supabaseUrl: import.meta.env["VITE_SUPABASE_URL"] ?? "(missing)",
    supabaseConfigured: isSupabaseConfigured(),
    missingEnv: missingClientEnv(),
  };
}

export function logAuthError(stage: AuthStage, error: unknown) {
  const err = error as { message?: string; status?: number; name?: string } | null;
  console.error("[auth] failure", {
    stage,
    name: err?.name,
    status: err?.status,
    message: err?.message ?? String(error),
    ...context(),
  });
}

/**
 * TEMPORARY production probe: prints the verbatim result of `getUser()` so a
 * deployment-only failure can be classified (missing build env vs unreachable
 * backend vs invalid session). Remove once production auth is confirmed.
 */
export function logGetUserProbe(
  where: string,
  result: { user: unknown; error: unknown },
) {
  const err = result.error as { name?: string; message?: string; status?: number } | null;
  console.info("[auth-probe] getUser", {
    where,
    userPresent: Boolean(result.user),
    error: err
      ? {
          name: err.name,
          message: err.message,
          status: err.status,
          raw: JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))),
        }
      : null,
    ...context(),
  });
}

export function logAuthEvent(stage: AuthStage, detail?: Record<string, unknown>) {
  console.info("[auth]", stage, { ...detail, ...context() });
}

/** Maps raw backend failures onto messages a teacher or student can act on. */
const FRIENDLY: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "That email and password don't match an account. Check both, or use “Forgot your password?”."],
  [/email not confirmed/i, "Confirm your email first — open the link we sent you, then sign in again."],
  [/user already registered|already been registered/i, "An account with this email already exists. Sign in instead, or reset your password."],
  [/password should be at least/i, "Choose a password with at least 6 characters."],
  [/unable to validate email|invalid email/i, "That email address doesn't look valid."],
  [/rate limit|too many requests/i, "Too many attempts. Wait a minute and try again."],
  [/user not found/i, "We couldn't find an account with that email."],
  [/same_password|should be different/i, "Your new password must be different from the old one."],
  [/unsupported provider|provider is not enabled/i, "Google sign-in isn't switched on for this deployment yet."],
  [/network|fetch failed|load failed/i, "We couldn't reach the backend. Check your connection and try again."],
];

/** Human-readable message for the toast, with deployment hints for env failures. */
export function authErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (!isSupabaseConfigured()) {
    return `This deployment is missing ${missingClientEnv().join(", ")}. Add them in your hosting provider's environment variables and redeploy.`;
  }
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Authentication could not reach the backend. Check this deployment's VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY build variables, then redeploy.";
  }
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  for (const [pattern, message] of FRIENDLY) {
    if (pattern.test(raw)) return message;
  }
  return raw || fallback;
}

