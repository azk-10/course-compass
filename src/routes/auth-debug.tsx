import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { missingClientEnv } from "@/lib/env";

/**
 * TEMPORARY diagnostic page. Open it on the deployed site to see exactly what
 * `supabase.auth.getUser()` returns in that environment. Delete once auth is
 * confirmed healthy in production. It never prints tokens or emails.
 */
export const Route = createFileRoute("/auth-debug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Auth diagnostics — Course Compass" },
      {
        name: "description",
        content:
          "Temporary diagnostics page reporting Supabase environment wiring and getUser() results for this deployment.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Auth diagnostics — Course Compass" },
      {
        property: "og:description",
        content: "Internal diagnostics for Course Compass authentication in this deployment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthDebugPage,
});

type Report = Record<string, unknown>;

function AuthDebugPage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
      const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

      const base: Report = {
        origin: window.location.origin,
        buildEnv: {
          VITE_SUPABASE_URL: url ?? "(missing at build time)",
          VITE_SUPABASE_PUBLISHABLE_KEY_present: Boolean(key),
          VITE_SUPABASE_PUBLISHABLE_KEY_prefix: key ? key.slice(0, 12) + "…" : null,
          missing: missingClientEnv(),
        },
        storageKeysPresent: Object.keys(localStorage).filter((k) => k.startsWith("sb-")),
      };

      // 1. Can the browser even reach the auth server? Bypasses the SDK entirely.
      if (url) {
        try {
          const res = await fetch(`${url}/auth/v1/health`, { headers: key ? { apikey: key } : {} });
          base["authHealth"] = { ok: res.ok, status: res.status, body: await res.text() };
        } catch (err) {
          base["authHealth"] = {
            ok: false,
            networkError: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          };
        }
      }

      // 2. The actual call under investigation — full error object, verbatim.
      const started = performance.now();
      try {
        const { data, error } = await supabase.auth.getUser();
        base["getUser"] = {
          ms: Math.round(performance.now() - started),
          userPresent: Boolean(data?.user),
          userId: data?.user?.id ?? null,
          error: error
            ? {
                name: error.name,
                message: error.message,
                status: (error as { status?: number }).status ?? null,
                code: (error as { code?: string }).code ?? null,
                raw: JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error))),
              }
            : null,
        };
      } catch (err) {
        base["getUser"] = {
          ms: Math.round(performance.now() - started),
          threw: true,
          error:
            err instanceof Error
              ? { name: err.name, message: err.message, stack: err.stack?.split("\n").slice(0, 4) }
              : String(err),
        };
      }

      // 3. Local session state, for comparing "cached token" vs "server-validated".
      try {
        const { data, error } = await supabase.auth.getSession();
        base["getSession"] = {
          sessionPresent: Boolean(data?.session),
          expiresAt: data?.session?.expires_at ?? null,
          expired: data?.session?.expires_at
            ? data.session.expires_at * 1000 < Date.now()
            : null,
          error: error ? { name: error.name, message: error.message } : null,
        };
      } catch (err) {
        base["getSession"] = { threw: true, error: String(err) };
      }

      console.info("[auth-debug]", base);
      if (active) setReport(base);
    };

    void run();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-2xl font-semibold">Auth diagnostics</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Temporary page. Open it on the deployed site, then copy the JSON below. It contains no
        tokens, passwords or email addresses.
      </p>
      <pre className="mt-6 overflow-auto rounded-lg border border-border bg-secondary p-4 text-xs">
        {report ? JSON.stringify(report, null, 2) : "Running checks…"}
      </pre>
      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li>
          <strong>buildEnv.missing not empty</strong> → the build variables were absent when Vercel
          compiled the bundle. Add them and redeploy (a restart is not enough).
        </li>
        <li>
          <strong>authHealth.networkError</strong> → the backend URL is wrong or blocked, so
          getUser() can never succeed.
        </li>
        <li>
          <strong>getUser.error AuthSessionMissingError</strong> → env and network are fine; there
          is simply no session. Sign in and reload this page.
        </li>
        <li>
          <strong>getSession.sessionPresent true but getUser errors</strong> → the stored refresh
          token is invalid for this project (wrong project keys, or the session was issued by a
          different backend).
        </li>
      </ul>
    </main>
  );
}
