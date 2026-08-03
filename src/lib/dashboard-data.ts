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

const COURSE_FIELDS = "id, title, term, accent, status, is_crash, archived_at";

export type Question = {
  id: string;
  prompt: string;
  kind: string;
  options: string[];
  points: number;
  position: number;
};

export type QuestionGroup = {
  id: string;
  name: string;
  position: number;
  questions: Question[];
};

export type Session = {
  id: string;
  course_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
};

export type ResponseRow = {
  id: string;
  question_id: string;
  student_label: string;
  is_correct: boolean;
  responded_at: string;
};

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
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("courses")
    .insert({
      teacher_id: userId,
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

export async function fetchGroups(courseId: string): Promise<QuestionGroup[]> {
  const { data, error } = await supabase
    .from("question_groups")
    .select("id, name, position, questions(id, prompt, kind, options, points, position)")
    .eq("course_id", courseId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    position: group.position,
    questions: [...((group.questions ?? []) as unknown as Question[])]
      .map((q) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] }))
      .sort((a, b) => a.position - b.position),
  }));
}

export async function fetchLiveSession(courseId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, course_id, status, started_at, ended_at")
    .eq("course_id", courseId)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchResponses(sessionId: string): Promise<ResponseRow[]> {
  const { data, error } = await supabase
    .from("responses")
    .select("id, question_id, student_label, is_correct, responded_at")
    .eq("session_id", sessionId)
    .order("responded_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function startSession(courseId: string): Promise<Session> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("sessions")
    .insert({ course_id: courseId, teacher_id: userId })
    .select("id, course_id, status, started_at, ended_at")
    .single();
  if (error) throw error;
  return data;
}

export async function endSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function recordResponse(input: {
  sessionId: string;
  questionId: string;
  studentLabel: string;
  isCorrect: boolean;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase.from("responses").insert({
    session_id: input.sessionId,
    question_id: input.questionId,
    teacher_id: userId,
    student_label: input.studentLabel,
    is_correct: input.isCorrect,
  });
  if (error) throw error;
}
