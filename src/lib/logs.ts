import { supabase } from "@/integrations/supabase/client";

/**
 * Structured, fire-and-forget audit trail. Logging must never break a student's
 * message, so every failure is swallowed after a console warning.
 */
export type LogKind =
  | "thread_merge"
  | "thread_separate"
  | "thread_reopen"
  | "classification"
  | "spam_detected"
  | "teacher_action"
  | "ai_failure";

export type LogEntry = {
  kind: LogKind;
  sessionId?: string | null;
  teacherId?: string | null;
  organizationId?: string | null;
  confidence?: number | null;
  detail?: Record<string, unknown>;
};

let devMode = false;

export function setDevMode(on: boolean) {
  devMode = on;
  if (typeof window !== "undefined") localStorage.setItem("cc:dev-mode", on ? "1" : "0");
}

export function readDevMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("cc:dev-mode") === "1";
}

export function logEvent(entry: LogEntry): void {
  if (devMode) {
    // eslint-disable-next-line no-console
    console.info(`[course-compass] ${entry.kind}`, entry.detail ?? {}, entry.confidence ?? "");
  }
  void supabase
    .from("activity_logs")
    .insert({
      kind: entry.kind,
      session_id: entry.sessionId ?? null,
      teacher_id: entry.teacherId ?? null,
      organization_id: entry.organizationId ?? null,
      confidence: entry.confidence ?? null,
      detail: (entry.detail ?? {}) as never,
    })
    .then(({ error }) => {
      if (error) console.warn("log failed", error.message);
    });
}
