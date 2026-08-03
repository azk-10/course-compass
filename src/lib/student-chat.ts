import { supabase } from "@/integrations/supabase/client";

export type StudentCourse = {
  id: string;
  title: string;
  term: string | null;
  is_crash: boolean;
  teacher_id: string;
  join_code: string;
};

export type LiveClass = {
  id: string;
  course_id: string;
  teacher_id: string;
  title: string;
  mode: string;
  pinned_message_id: string | null;
  quiz_prompt: string | null;
  quiz_answer_type: string | null;
  quiz_options: string[];
  resolve_threshold: number;
  started_at: string;
};

export type MyEnrollment = {
  id: string;
  course_id: string;
  status: string;
  student_label: string;
};

const COURSE_FIELDS = "id, title, term, is_crash, teacher_id, join_code";

/** Students never browse a catalogue — they look their course up by its code. */
export async function fetchCourseByCode(code: string): Promise<StudentCourse | null> {
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_FIELDS)
    .eq("join_code", code.trim().toUpperCase())
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchCoursesByIds(ids: string[]): Promise<StudentCourse[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("courses").select(COURSE_FIELDS).in("id", ids);
  if (error) throw error;
  return data ?? [];
}

/** The single live session of a course, if any. */
export async function fetchLiveClass(courseId: string): Promise<LiveClass | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, course_id, teacher_id, title, mode, pinned_message_id, quiz_prompt, quiz_answer_type, quiz_options, resolve_threshold, started_at",
    )
    .eq("course_id", courseId)
    .eq("status", "live")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    quiz_options: Array.isArray(data.quiz_options) ? (data.quiz_options as string[]) : [],
  };
}

export async function fetchMyEnrollments(userId: string): Promise<MyEnrollment[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, course_id, status, student_label")
    .eq("student_user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function requestEnrollment(input: {
  courseId: string;
  teacherId: string;
  studentUserId: string;
  studentLabel: string;
  email: string;
  phone: string;
}): Promise<void> {
  const { error } = await supabase.from("enrollments").insert({
    course_id: input.courseId,
    teacher_id: input.teacherId,
    student_user_id: input.studentUserId,
    student_label: input.studentLabel,
    student_email: input.email,
    student_phone: input.phone,
  });
  if (error) throw error;
}
