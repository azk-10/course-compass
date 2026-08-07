/**
 * Client-safe environment checks.
 *
 * On a self-hosted deploy (Vercel, Netlify, …) the Supabase variables have to be
 * configured by hand. When they are missing the generated Supabase client throws
 * on first use, which would otherwise take the whole page down. These helpers let
 * call sites degrade gracefully instead of crashing SSR or hydration.
 */

function getClientEnvValue(name: string): string | undefined {
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const direct = env[name];
  if (typeof direct === "string" && direct.trim()) return direct;

  const bare = name.replace(/^VITE_/, "");
  const fallback = env[bare];
  if (typeof fallback === "string" && fallback.trim()) return fallback;

  return undefined;
}

export { getClientEnvValue };

const clientUrl = getClientEnvValue("VITE_SUPABASE_URL") ?? getClientEnvValue("SUPABASE_URL");
const clientKey =
  getClientEnvValue("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  getClientEnvValue("SUPABASE_PUBLISHABLE_KEY");

/** Variables the browser bundle needs, resolved at build time. */
export function missingClientEnv(): string[] {
  return [
    ...(clientUrl ? [] : ["VITE_SUPABASE_URL"]),
    ...(clientKey ? [] : ["VITE_SUPABASE_PUBLISHABLE_KEY"]),
  ];
}

export function isSupabaseConfigured(): boolean {
  return missingClientEnv().length === 0;
}

/** Runs `fn` only when Supabase is configured; never throws. */
export function safeSupabase<T>(fn: () => T, fallback: T): T {
  if (!isSupabaseConfigured()) {
    console.warn(
      `[env] Skipping Supabase call — missing ${missingClientEnv().join(", ")}. ` +
        "Set these environment variables in your hosting provider and redeploy.",
    );
    return fallback;
  }
  try {
    return fn();
  } catch (error) {
    console.error("[env] Supabase call failed", error);
    return fallback;
  }
}
