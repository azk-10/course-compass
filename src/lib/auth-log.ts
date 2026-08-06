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

export function logAuthEvent(stage: AuthStage, detail?: Record<string, unknown>) {
  console.info("[auth]", stage, { ...detail, ...context() });
}

/** Human-readable message for the toast, with deployment hints for env failures. */
export function authErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (!isSupabaseConfigured()) {
    return `This deployment is missing ${missingClientEnv().join(", ")}. Add them in your hosting provider's environment variables and redeploy.`;
  }
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Authentication could not reach the backend. Check this deployment's VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY build variables, then redeploy.";
  }
  return error instanceof Error ? error.message : fallback;
}
