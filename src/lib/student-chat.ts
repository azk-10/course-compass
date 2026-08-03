import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string;
  session_id: string;
  sender_label: string;
  is_teacher: boolean;
  body: string;
  created_at: string;
};

export type LiveClass = {
  id: string;
  course_id: string;
  started_at: string;
  title: string;
};

export async function fetchLiveClasses(): Promise<LiveClass[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, course_id, started_at, courses(title)")
    .eq("status", "live")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    course_id: row.course_id,
    started_at: row.started_at,
    title: (row.courses as { title: string } | null)?.title ?? "Live class",
  }));
}

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, session_id, sender_label, is_teacher, body, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(input: {
  sessionId: string;
  senderLabel: string;
  body: string;
}): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    session_id: input.sessionId,
    sender_label: input.senderLabel,
    body: input.body,
  });
  if (error) throw error;
}

export type StudentCourse = {
  id: string;
  title: string;
  term: string | null;
  is_crash: boolean;
  teacher_id: string;
};

export async function fetchActiveCourses(): Promise<StudentCourse[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, term, is_crash, teacher_id")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyEnrollments(studentLabel: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, course_id, status")
    .eq("student_label", studentLabel);
  if (error) throw error;
  return data ?? [];
}

export async function requestEnrollment(input: {
  courseId: string;
  teacherId: string;
  studentLabel: string;
}): Promise<void> {
  const { error } = await supabase.from("enrollments").insert({
    course_id: input.courseId,
    teacher_id: input.teacherId,
    student_label: input.studentLabel,
  });
  if (error) throw error;
}
