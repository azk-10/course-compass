import { supabase } from "@/integrations/supabase/client";

/**
 * Every message is stored raw and immutable. Grouping (AI or manual) will be a
 * derived layer built on top of these rows later — nothing here overwrites or
 * deletes the original message.
 */
export type MessageType = "chat" | "answer";

export type ChatMessage = {
  id: string;
  session_id: string;
  course_id: string | null;
  student_id: string | null;
  thread_id: string | null;
  sender_label: string;
  is_teacher: boolean;
  message_type: string;
  body: string;
  created_at: string;
};

export const MESSAGE_FIELDS =
  "id, session_id, course_id, student_id, thread_id, sender_label, is_teacher, message_type, body, created_at";

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function sendMessage(input: {
  sessionId: string;
  courseId: string;
  senderLabel: string;
  body: string;
  isTeacher?: boolean;
  studentId?: string | null;
  threadId?: string | null;
  messageType?: MessageType;
}): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    session_id: input.sessionId,
    course_id: input.courseId,
    sender_label: input.senderLabel,
    body: input.body,
    is_teacher: input.isTeacher ?? false,
    student_id: input.studentId ?? null,
    thread_id: input.threadId ?? null,
    message_type: input.messageType ?? "chat",
  });
  if (error) throw error;
}

/** Distinct students seen in the feed within the last few minutes. */
export function studentsOnline(messages: ChatMessage[], windowMinutes = 10): string[] {
  const cutoff = Date.now() - windowMinutes * 60_000;
  const seen = new Set<string>();
  for (const message of messages) {
    if (message.is_teacher) continue;
    if (new Date(message.created_at).getTime() >= cutoff) seen.add(message.sender_label);
  }
  return [...seen];
}
