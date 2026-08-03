import { supabase } from "@/integrations/supabase/client";
import { toCategory, type Category } from "@/lib/classify";
import { textSimilarity } from "@/lib/grouping";

/**
 * Merged discussion threads. Students never read each other's chats — they see
 * their own messages plus the live aggregate of the threads they joined.
 */
export type Thread = {
  id: string;
  session_id: string;
  course_id: string | null;
  teacher_id: string | null;
  title: string;
  status: string;
  category: string;
  created_at: string;
  last_activity_at: string;
};

export type ThreadRow = { id: string; thread_id: string; student_label: string };
export type FeedbackRow = ThreadRow & { state: string };
export type FeedbackState = "resolved" | "need_help";

export type ThreadHealth = "new" | "attention" | "urgent" | "settled";

export type ThreadStats = {
  thread: Thread;
  /** Dominant message type of the thread. */
  category: Category;
  /** Distinct students who joined or created the thread. */
  students: number;
  upvotes: number;
  resolved: number;
  needHelp: number;
  /** Share of responding students who marked it resolved (0-100). */
  resolvedPct: number;
  health: ThreadHealth;
  /** Higher first. Spam and settled threads always sink to the bottom. */
  priority: number;
};

const THREAD_FIELDS =
  "id, session_id, course_id, teacher_id, title, status, category, created_at, last_activity_at";


/* ---------------------------------- reads ---------------------------------- */

export async function fetchThreads(sessionId: string): Promise<Thread[]> {
  const { data, error } = await supabase
    .from("threads")
    .select(THREAD_FIELDS)
    .eq("session_id", sessionId)
    .order("last_activity_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data ?? [];
}

export async function fetchParticipants(sessionId: string): Promise<ThreadRow[]> {
  const { data, error } = await supabase
    .from("thread_participants")
    .select("id, thread_id, student_label")
    .eq("session_id", sessionId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchVotes(sessionId: string): Promise<ThreadRow[]> {
  const { data, error } = await supabase
    .from("thread_votes")
    .select("id, thread_id, student_label")
    .eq("session_id", sessionId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchFeedback(sessionId: string): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from("thread_feedback")
    .select("id, thread_id, student_label, state")
    .eq("session_id", sessionId);
  if (error) throw error;
  return data ?? [];
}

/* --------------------------------- mutations -------------------------------- */

export async function createThread(input: {
  sessionId: string;
  courseId: string;
  teacherId: string | null;
  title: string;
  studentLabel: string;
  category?: Category;
}): Promise<Thread> {
  const { data, error } = await supabase
    .from("threads")
    .insert({
      session_id: input.sessionId,
      course_id: input.courseId,
      teacher_id: input.teacherId,
      title: input.title.slice(0, 160),
      category: input.category ?? "question",
    })

    .select(THREAD_FIELDS)
    .single();
  if (error) throw error;
  await joinThread({
    threadId: data.id,
    sessionId: input.sessionId,
    studentLabel: input.studentLabel,
  });
  return data;
}

export async function joinThread(input: {
  threadId: string;
  sessionId: string;
  studentLabel: string;
}): Promise<void> {
  const { error } = await supabase.from("thread_participants").upsert(
    {
      thread_id: input.threadId,
      session_id: input.sessionId,
      student_label: input.studentLabel,
    },
    { onConflict: "thread_id,student_label", ignoreDuplicates: true },
  );
  if (error) throw error;
  await supabase
    .from("threads")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", input.threadId);
}

export async function setVote(input: {
  threadId: string;
  sessionId: string;
  studentLabel: string;
  voted: boolean;
}): Promise<void> {
  if (input.voted) {
    const { error } = await supabase.from("thread_votes").upsert(
      {
        thread_id: input.threadId,
        session_id: input.sessionId,
        student_label: input.studentLabel,
      },
      { onConflict: "thread_id,student_label", ignoreDuplicates: true },
    );
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("thread_votes")
    .delete()
    .eq("thread_id", input.threadId)
    .eq("student_label", input.studentLabel);
  if (error) throw error;
}

export async function setFeedback(input: {
  threadId: string;
  sessionId: string;
  studentLabel: string;
  state: FeedbackState | null;
}): Promise<void> {
  if (!input.state) {
    const { error } = await supabase
      .from("thread_feedback")
      .delete()
      .eq("thread_id", input.threadId)
      .eq("student_label", input.studentLabel);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("thread_feedback").upsert(
    {
      thread_id: input.threadId,
      session_id: input.sessionId,
      student_label: input.studentLabel,
      state: input.state,
    },
    { onConflict: "thread_id,student_label" },
  );
  if (error) throw error;
}

/* ---------------------------------- derive ---------------------------------- */

export function buildStats(input: {
  threads: Thread[];
  participants: ThreadRow[];
  votes: ThreadRow[];
  feedback: FeedbackRow[];
  threshold: number;
  /** Threads the classroom health checks pushed to the very top. */
  boosted?: string[];
}): ThreadStats[] {
  const { threads, participants, votes, feedback, threshold } = input;
  const boosted = new Set(input.boosted ?? []);

  const count = (rows: { thread_id: string }[]) => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.thread_id, (map.get(row.thread_id) ?? 0) + 1);
    return map;
  };

  const students = count(participants);
  const upvotes = count(votes);
  const resolved = count(feedback.filter((row) => row.state === "resolved"));
  const needHelp = count(feedback.filter((row) => row.state === "need_help"));

  return threads
    .map((thread) => {
      const category = toCategory(thread.category);
      const s = students.get(thread.id) ?? 0;
      const up = upvotes.get(thread.id) ?? 0;
      const ok = resolved.get(thread.id) ?? 0;
      const help = needHelp.get(thread.id) ?? 0;
      const answered = ok + help;
      const resolvedPct = answered ? Math.round((ok / answered) * 100) : 0;
      const helpShare = answered ? help / answered : 0;
      const boost = boosted.has(thread.id);

      const settled =
        !boost && (thread.status === "archived" || (answered > 0 && resolvedPct >= threshold));
      const health: ThreadHealth = boost
        ? "urgent"
        : settled
          ? "settled"
          : helpShare >= 0.6 && help >= 3
            ? "urgent"
            : help >= 1
              ? "attention"
              : "new";

      // Spam never competes for the teacher's attention.
      const priority =
        category === "spam"
          ? -1000
          : boost
            ? 10_000
            : settled
              ? -1
              : s + up * 2 + help * 3 - ok;

      return {
        thread,
        category,
        students: s,
        upvotes: up,
        resolved: ok,
        needHelp: help,
        resolvedPct,
        health,
        priority,
      };
    })
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        b.thread.last_activity_at.localeCompare(a.thread.last_activity_at),
    );
}


/** Best existing thread for a draft message, when it is close enough to merge. */
export function findSimilarThread(draft: string, threads: Thread[], min = 0.45) {
  const [best] = topSimilarThreads(draft, threads, 1, min);
  return best ?? null;
}

/** Ranked merge candidates for a draft, loose enough for the AI to arbitrate. */
export function topSimilarThreads(draft: string, threads: Thread[], limit = 5, min = 0.2) {
  return threads
    .map((thread) => ({ thread, score: textSimilarity(draft, thread.title) }))
    .filter((row) => row.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** A revived thread comes back to the top instead of spawning a duplicate. */
export async function reopenThread(threadId: string): Promise<void> {
  await supabase
    .from("threads")
    .update({ status: "open", last_activity_at: new Date().toISOString() })
    .eq("id", threadId);
}

export async function leaveThread(input: {
  threadId: string;
  studentLabel: string;
}): Promise<void> {
  await supabase
    .from("thread_participants")
    .delete()
    .eq("thread_id", input.threadId)
    .eq("student_label", input.studentLabel);
  await supabase
    .from("thread_votes")
    .delete()
    .eq("thread_id", input.threadId)
    .eq("student_label", input.studentLabel);
  await supabase
    .from("thread_feedback")
    .delete()
    .eq("thread_id", input.threadId)
    .eq("student_label", input.studentLabel);
}

/**
 * The student always keeps control: pull one message out of a merged thread
 * into its own thread, and leave the old thread if nothing else keeps them there.
 */
export async function separateMessage(input: {
  messageId: string;
  body: string;
  fromThreadId: string | null;
  sessionId: string;
  courseId: string;
  teacherId: string | null;
  studentLabel: string;
  /** Other messages of this student still attached to the old thread. */
  stillAttached: number;
}): Promise<Thread> {
  const thread = await createThread({
    sessionId: input.sessionId,
    courseId: input.courseId,
    teacherId: input.teacherId,
    title: input.body,
    studentLabel: input.studentLabel,
  });

  const { error } = await supabase
    .from("messages")
    .update({ thread_id: thread.id })
    .eq("id", input.messageId);
  if (error) throw error;

  if (input.fromThreadId && input.stillAttached <= 0) {
    await leaveThread({ threadId: input.fromThreadId, studentLabel: input.studentLabel });
  }
  return thread;
}

