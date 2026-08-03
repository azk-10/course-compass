import { supabase } from "@/integrations/supabase/client";

export type StudentCourse = {
  id: string;
  title: string;
  term: string | null;
  is_crash: boolean;
  teacher_id: string;
};

export type LiveClass = {
  id: string;
  course_id: string;
  title: string;
  mode: string;
  pinned_message_id: string | null;
  quiz_prompt: string | null;
  quiz_answer_type: string | null;
  quiz_options: string[];
  started_at: string;
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

/** The single live session of a course, if any. */
export async function fetchLiveClass(courseId: string): Promise<LiveClass | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, course_id, title, mode, pinned_message_id, quiz_prompt, quiz_answer_type, quiz_options, started_at",
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
