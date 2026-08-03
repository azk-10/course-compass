import { supabase } from "@/integrations/supabase/client";
import { isAudioIssue, toCategory } from "@/lib/classify";
import type { ChatMessage } from "@/lib/live-chat";



/**
 * Classroom-wide health checks. They are created automatically from live chat
 * signals — never by the teacher — and disappear for a student as soon as they
 * answer.
 */
export type PollKind = "audio" | "question_confirm";

export type Poll = {
  id: string;
  session_id: string;
  thread_id: string | null;
  kind: string;
  prompt: string;
  status: string;
  created_at: string;
};

export type PollResponse = {
  id: string;
  poll_id: string;
  student_label: string;
  answer: string;
};

const POLL_FIELDS = "id, session_id, thread_id, kind, prompt, status, created_at";

export async function fetchPolls(sessionId: string): Promise<Poll[]> {
  const { data, error } = await supabase
    .from("polls")
    .select(POLL_FIELDS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPollResponses(sessionId: string): Promise<PollResponse[]> {
  const { data, error } = await supabase
    .from("poll_responses")
    .select("id, poll_id, student_label, answer")
    .eq("session_id", sessionId);
  if (error) throw error;
  return data ?? [];
}

/** Idempotent: one poll per session + kind + thread. */
export async function openPoll(input: {
  sessionId: string;
  kind: PollKind;
  threadId?: string | null;
  prompt: string;
}): Promise<void> {
  await supabase.from("polls").insert({
    session_id: input.sessionId,
    kind: input.kind,
    thread_id: input.threadId ?? null,
    prompt: input.prompt,
  });
}

export async function answerPoll(input: {
  pollId: string;
  sessionId: string;
  studentLabel: string;
  answer: "yes" | "no";
}): Promise<void> {
  await supabase.from("poll_responses").insert({
    poll_id: input.pollId,
    session_id: input.sessionId,
    student_label: input.studentLabel,
    answer: input.answer,
  });
}

/** Majority verdict of a poll, ignoring students who never replied. */
export function pollVerdict(poll: Poll, responses: PollResponse[]) {
  const mine = responses.filter((row) => row.poll_id === poll.id);
  const yes = mine.filter((row) => row.answer === "yes").length;
  const no = mine.length - yes;
  return { yes, no, total: mine.length, majorityNo: mine.length >= 3 && no > yes };
}
