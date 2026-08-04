import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/logs";

/** Teacher emergency controls plus the student acknowledgement reactions. */

export type SessionBlock = {
  id: string;
  session_id: string;
  student_label: string;
  kind: string;
  until: string | null;
};

export type SessionReaction = {
  id: string;
  session_id: string;
  student_label: string;
  kind: string;
  updated_at: string;
};

export const REACTIONS = [
  { kind: "yes", label: "Yes", emoji: "👍" },
  { kind: "no", label: "No", emoji: "👎" },
  { kind: "okay", label: "Okay", emoji: "🙂" },
  { kind: "understood", label: "Understood", emoji: "✅" },
  { kind: "repeat", label: "Repeat", emoji: "🔁" },
  { kind: "lost", label: "Didn't get it", emoji: "😕" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];

const BLOCK_FIELDS = "id, session_id, student_label, kind, until";
const REACTION_FIELDS = "id, session_id, student_label, kind, updated_at";

export async function fetchBlocks(sessionId: string): Promise<SessionBlock[]> {
  const { data, error } = await supabase
    .from("session_blocks")
    .select(BLOCK_FIELDS)
    .eq("session_id", sessionId);
  if (error) throw error;
  return data ?? [];
}

export function isBlocked(blocks: SessionBlock[], label: string): SessionBlock | null {
  const now = Date.now();
  return (
    blocks.find(
      (block) =>
        block.student_label === label &&
        (block.kind === "remove" || !block.until || new Date(block.until).getTime() > now),
    ) ?? null
  );
}

export async function setChatPaused(sessionId: string, paused: boolean, teacherId: string) {
  const { error } = await supabase
    .from("sessions")
    .update({ chat_paused: paused })
    .eq("id", sessionId);
  if (error) throw error;
  logEvent({
    kind: "teacher_action",
    sessionId,
    teacherId,
    detail: { action: paused ? "pause_chat" : "resume_chat" },
  });
}

export async function muteStudent(input: {
  sessionId: string;
  teacherId: string;
  label: string;
  minutes: number;
}) {
  const until = new Date(Date.now() + input.minutes * 60_000).toISOString();
  const { error } = await supabase.from("session_blocks").upsert(
    {
      session_id: input.sessionId,
      teacher_id: input.teacherId,
      student_label: input.label,
      kind: "mute",
      until,
    },
    { onConflict: "session_id,student_label" },
  );
  if (error) throw error;
  logEvent({
    kind: "teacher_action",
    sessionId: input.sessionId,
    teacherId: input.teacherId,
    detail: { action: "mute", label: input.label, minutes: input.minutes },
  });
}

export async function removeStudent(input: {
  sessionId: string;
  teacherId: string;
  label: string;
}) {
  const { error } = await supabase.from("session_blocks").upsert(
    {
      session_id: input.sessionId,
      teacher_id: input.teacherId,
      student_label: input.label,
      kind: "remove",
      until: null,
    },
    { onConflict: "session_id,student_label" },
  );
  if (error) throw error;
  logEvent({
    kind: "teacher_action",
    sessionId: input.sessionId,
    teacherId: input.teacherId,
    detail: { action: "remove", label: input.label },
  });
}

export async function liftBlock(input: { sessionId: string; teacherId: string; label: string }) {
  const { error } = await supabase
    .from("session_blocks")
    .delete()
    .eq("session_id", input.sessionId)
    .eq("student_label", input.label);
  if (error) throw error;
  logEvent({
    kind: "teacher_action",
    sessionId: input.sessionId,
    teacherId: input.teacherId,
    detail: { action: "lift_block", label: input.label },
  });
}

/* --------------------------------- reactions -------------------------------- */

export async function fetchReactions(sessionId: string): Promise<SessionReaction[]> {
  const { data, error } = await supabase
    .from("session_reactions")
    .select(REACTION_FIELDS)
    .eq("session_id", sessionId);
  if (error) throw error;
  return data ?? [];
}

export async function react(input: { sessionId: string; label: string; kind: ReactionKind }) {
  const { error } = await supabase.from("session_reactions").upsert(
    {
      session_id: input.sessionId,
      student_label: input.label,
      kind: input.kind,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,student_label" },
  );
  if (error) throw error;
}

/** Share of recently reacting students per reaction, within a rolling window. */
export function reactionShares(
  reactions: SessionReaction[],
  windowMinutes = 3,
): { kind: ReactionKind; count: number; pct: number }[] {
  const cutoff = Date.now() - windowMinutes * 60_000;
  const recent = reactions.filter((item) => new Date(item.updated_at).getTime() >= cutoff);
  const total = recent.length || 1;
  return REACTIONS.map((reaction) => {
    const count = recent.filter((item) => item.kind === reaction.kind).length;
    return { kind: reaction.kind, count, pct: Math.round((count / total) * 100) };
  });
}
