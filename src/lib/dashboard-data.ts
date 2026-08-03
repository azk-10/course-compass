import { supabase } from "@/integrations/supabase/client";

export type Course = {
  id: string;
  title: string;
  term: string | null;
  accent: string;
  status: string;
  is_crash: boolean;
  archived_at: string | null;
};

export type Enrollment = {
  id: string;
  course_id: string;
  student_label: string;
  status: string;
  created_at: string;
};

export type SessionMode = "question" | "quiz";
export type AnswerType = "multiple_choice" | "number" | "short_text" | "formula";

export type Session = {
  id: string;
  course_id: string;
  title: string;
  status: string;
  mode: string;
  pinned_message_id: string | null;
  quiz_prompt: string | null;
  quiz_answer_type: string | null;
  quiz_options: string[];
  resolve_threshold: number;
  started_at: string;
  ended_at: string | null;
};

const COURSE_FIELDS = "id, title, term, accent, status, is_crash, archived_at";
const SESSION_FIELDS =
  "id, course_id, title, status, mode, pinned_message_id, quiz_prompt, quiz_answer_type, quiz_options, resolve_threshold, started_at, ended_at";

type RawSession = Omit<Session, "quiz_options"> & { quiz_options: unknown };

function toSession(row: RawSession): Session {
  return {
    ...row,
    quiz_options: Array.isArray(row.quiz_options) ? (row.quiz_options as string[]) : [],
  };
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

/* ---------------------------------- courses --------------------------------- */

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_FIELDS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCourse(input: {
  title: string;
  term: string | null;
  accent: string;
  isCrash: boolean;
}): Promise<Course> {
  const teacherId = await requireUserId();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      teacher_id: teacherId,
      title: input.title,
      term: input.term,
      accent: input.accent,
      is_crash: input.isCrash,
    })
    .select(COURSE_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function setCourseArchived(courseId: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .update({
      status: archived ? "archived" : "active",
      archived_at: archived ? new Date().toISOString() : null,
    })
    .eq("id", courseId);
  if (error) throw error;
}

/** Deletes the course together with its students, sessions and messages. */
export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw error;
}

/* -------------------------------- enrollments ------------------------------- */

export async function fetchEnrollments(courseId: string): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, course_id, student_label, status, created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function setEnrollmentStatus(
  enrollmentId: string,
  status: "approved" | "declined",
): Promise<void> {
  const { error } = await supabase.from("enrollments").update({ status }).eq("id", enrollmentId);
  if (error) throw error;
}

export async function removeCourseStudents(courseId: string): Promise<void> {
  const { error } = await supabase.from("enrollments").delete().eq("course_id", courseId);
  if (error) throw error;
}

/* --------------------------------- sessions --------------------------------- */

export async function fetchSessions(courseId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_FIELDS)
    .eq("course_id", courseId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toSession(row as RawSession));
}

export async function fetchLiveSession(courseId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_FIELDS)
    .eq("course_id", courseId)
    .eq("status", "live")
    .maybeSingle();
  if (error) throw error;
  return data ? toSession(data as RawSession) : null;
}

export async function startSession(input: { courseId: string; title: string }): Promise<Session> {
  const teacherId = await requireUserId();
  // Only one session can be live at a time.
  await supabase
    .from("sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("teacher_id", teacherId)
    .eq("status", "live");

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      course_id: input.courseId,
      teacher_id: teacherId,
      title: input.title,
      mode: "question",
    })
    .select(SESSION_FIELDS)
    .single();
  if (error) throw error;
  return toSession(data as RawSession);
}

export async function endSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function setSessionMode(sessionId: string, mode: SessionMode): Promise<void> {
  const { error } = await supabase.from("sessions").update({ mode }).eq("id", sessionId);
  if (error) throw error;
}

export async function setPinnedMessage(
  sessionId: string,
  messageId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ pinned_message_id: messageId })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function setQuiz(input: {
  sessionId: string;
  prompt: string;
  answerType: AnswerType;
  options: string[];
}): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({
      mode: "quiz",
      quiz_prompt: input.prompt,
      quiz_answer_type: input.answerType,
      quiz_options: input.options,
    })
    .eq("id", input.sessionId);
  if (error) throw error;
}

/** Percentage of responding students needed before a thread auto-archives. */
export async function setResolveThreshold(sessionId: string, threshold: number): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ resolve_threshold: Math.min(100, Math.max(10, Math.round(threshold))) })
    .eq("id", sessionId);
  if (error) throw error;
}
