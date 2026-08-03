import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { useLiveMessages } from "@/hooks/useLiveMessages";
import { answerKey } from "@/lib/grouping";
import { sendMessage } from "@/lib/live-chat";
import type { LiveClass } from "@/lib/student-chat";

export function StudentChat({
  liveClass,
  studentName,
}: {
  liveClass: LiveClass;
  studentName: string;
}) {
  const [draft, setDraft] = useState("");
  const { messages, isLoading, connection } = useLiveMessages(liveClass.id);
  const pinned = messages.find((message) => message.id === liveClass.pinned_message_id) ?? null;
  const quizMode = liveClass.mode === "quiz" && !!liveClass.quiz_prompt;
  const correct = pinned && pinned.message_type === "answer" ? pinned : null;
  const myAnswer = [...messages]
    .reverse()
    .find(
      (message) => message.message_type === "answer" && message.sender_label === studentName,
    );
  const iAmCorrect = correct && myAnswer ? answerKey(myAnswer.body) === answerKey(correct.body) : null;

  const sendMutation = useMutation({
    mutationFn: (input: { body: string; type: "chat" | "answer" }) =>
      sendMessage({
        sessionId: liveClass.id,
        courseId: liveClass.course_id,
        senderLabel: studentName,
        body: input.body,
        messageType: input.type,
      }),
    onError: (error: Error) => toast.error(error.message || "Could not send message"),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim().slice(0, 1000);
    if (!body || sendMutation.isPending) return;
    setDraft("");
    sendMutation.mutate({ body, type: quizMode ? "answer" : "chat" });
  };

  const statusMeta = {
    connecting: { label: "Connecting…", className: "text-muted-foreground" },
    live: { label: "Live", className: "text-success" },
    offline: { label: "Reconnecting…", className: "text-destructive" },
  } as const;
  const status = statusMeta[connection];

  return (
    <div className="panel flex h-[75vh] flex-col overflow-hidden">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-display text-sm font-semibold">{liveClass.title}</h2>
          <p className="truncate text-xs text-muted-foreground">Joined as {studentName}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-2 text-xs font-medium ${status.className}`}
        >
          {connection === "live" && <span className="live-dot" />}
          {status.label}
        </span>
      </header>

      {correct ? (
        <div
          className={`border-b border-border px-5 py-3 ${
            iAmCorrect === null
              ? "bg-secondary"
              : iAmCorrect
                ? "bg-success/12"
                : "bg-destructive/10"
          }`}
        >
          <p className="text-[0.66rem] tracking-[0.14em] text-muted-foreground uppercase">
            Correct answer
          </p>
          <p className="text-sm font-medium break-words">{correct.body}</p>
          {myAnswer && (
            <p
              className={`mt-1 text-xs font-medium ${iAmCorrect ? "text-success" : "text-destructive"}`}
            >
              Your answer “{myAnswer.body}” {iAmCorrect ? "matches" : "does not match"}.
            </p>
          )}
        </div>
      ) : (
        pinned && (
        <div className="border-b border-border bg-accent/12 px-5 py-3">
          <p className="text-[0.66rem] tracking-[0.14em] text-accent uppercase">
            Currently discussing
          </p>
          <p className="text-sm break-words">{pinned.body}</p>
        </div>
        )
      )}

      {quizMode && (
        <div className="border-b border-border bg-secondary px-5 py-3">
          <p className="text-[0.66rem] tracking-[0.14em] text-muted-foreground uppercase">
            Answer mode · {liveClass.quiz_answer_type?.replace("_", " ")}
          </p>
          <p className="text-sm font-medium">{liveClass.quiz_prompt}</p>
          {liveClass.quiz_answer_type === "multiple_choice" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {liveClass.quiz_options.map((option) => (
                <button
                  key={option}
                  onClick={() => sendMutation.mutate({ body: option, type: "answer" })}
                  disabled={sendMutation.isPending}
                  className="rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-background disabled:opacity-50"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <LiveFeed
        messages={messages}
        isLoading={isLoading}
        pinnedId={liveClass.pinned_message_id}
        selfLabel={studentName}
        emptyLabel="No messages yet — ask the first question."
      />

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border px-4 py-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          placeholder={quizMode ? "Type your answer…" : "Type a message…"}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sendMutation.isPending}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
          Send
        </button>
      </form>
    </div>
  );
}
