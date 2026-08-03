import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, CheckCircle2, HelpCircle, Send, Sparkles, Split, Users } from "lucide-react";
import { toast } from "sonner";

import { useLiveMessages } from "@/hooks/useLiveMessages";
import { useThreads } from "@/hooks/useThreads";
import { answerKey } from "@/lib/grouping";
import { sendMessage, type ChatMessage } from "@/lib/live-chat";
import { judgeMerge } from "@/lib/merge.functions";
import {
  createThread,
  joinThread,
  reopenThread,
  separateMessage,
  setFeedback,
  setVote,
  topSimilarThreads,
  type FeedbackState,
  type Thread,
  type ThreadStats,
} from "@/lib/threads";
import type { LiveClass } from "@/lib/student-chat";

/** No new activity for this long → ask participants if they got it. */
const FOLLOW_UP_MS = 75_000;

/**
 * Students see a normal chat: sending is instant and merging happens
 * automatically behind the scenes. They keep full control of every message.
 */
export function StudentChat({
  liveClass,
  studentName,
}: {
  liveClass: LiveClass;
  studentName: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const judge = useServerFn(judgeMerge);

  const { messages, isLoading, connection } = useLiveMessages(liveClass.id);
  const { threads, participants, votes, feedback, stats } = useThreads(
    liveClass.id,
    liveClass.resolve_threshold,
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const quizMode = liveClass.mode === "quiz" && !!liveClass.quiz_prompt;
  const myMessages = messages.filter(
    (message) => !message.is_teacher && message.sender_label === studentName,
  );
  const myChats = myMessages.filter((message) => message.message_type !== "answer");

  const myThreadIds = useMemo(
    () =>
      new Set(
        participants.filter((row) => row.student_label === studentName).map((row) => row.thread_id),
      ),
    [participants, studentName],
  );
  const myThreads = stats.filter((item) => myThreadIds.has(item.thread.id));
  const statsById = new Map(stats.map((item) => [item.thread.id, item]));
  const myVotes = new Set(
    votes.filter((row) => row.student_label === studentName).map((row) => row.thread_id),
  );
  const myFeedback = new Map(
    feedback
      .filter((row) => row.student_label === studentName)
      .map((row) => [row.thread_id, row.state as FeedbackState]),
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["threads", liveClass.id] });
    queryClient.invalidateQueries({ queryKey: ["thread-participants", liveClass.id] });
    queryClient.invalidateQueries({ queryKey: ["thread-votes", liveClass.id] });
    queryClient.invalidateQueries({ queryKey: ["thread-feedback", liveClass.id] });
  };

  /** Auto-merge: candidates are shortlisted locally, then confirmed by AI. */
  const postMutation = useMutation({
    mutationFn: async (body: string) => {
      const candidates = topSimilarThreads(body, threads, 6).map((row) => ({
        id: row.thread.id,
        title: row.thread.title,
      }));

      let matched: Thread | null = null;
      let aiTitle: string | null = null;
      if (candidates.length > 0) {
        try {
          const verdict = await judge({ data: { draft: body, candidates } });
          aiTitle = verdict.title;
          matched = threads.find((thread) => thread.id === verdict.threadId) ?? null;
        } catch {
          matched = null;
        }
      }

      const thread =
        matched ??
        (await createThread({
          sessionId: liveClass.id,
          courseId: liveClass.course_id,
          teacherId: liveClass.teacher_id ?? null,
          title: aiTitle || body,
          studentLabel: studentName,
        }));

      if (matched) {
        await joinThread({
          threadId: thread.id,
          sessionId: liveClass.id,
          studentLabel: studentName,
        });
        if (matched.status !== "open") await reopenThread(matched.id);
      }

      await sendMessage({
        sessionId: liveClass.id,
        courseId: liveClass.course_id,
        senderLabel: studentName,
        body,
        threadId: thread.id,
      });
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message || "Could not send your message"),
  });

  const answerMutation = useMutation({
    mutationFn: (body: string) =>
      sendMessage({
        sessionId: liveClass.id,
        courseId: liveClass.course_id,
        senderLabel: studentName,
        body,
        messageType: "answer",
      }),
    onError: (error: Error) => toast.error(error.message || "Could not send your answer"),
  });

  const voteMutation = useMutation({
    mutationFn: (input: { threadId: string; voted: boolean }) =>
      setVote({
        threadId: input.threadId,
        sessionId: liveClass.id,
        studentLabel: studentName,
        voted: input.voted,
      }),
    onSuccess: refresh,
  });

  const feedbackMutation = useMutation({
    mutationFn: (input: { threadId: string; state: FeedbackState | null }) =>
      setFeedback({
        threadId: input.threadId,
        sessionId: liveClass.id,
        studentLabel: studentName,
        state: input.state,
      }),
    onSuccess: refresh,
  });

  const separateMutation = useMutation({
    mutationFn: (message: ChatMessage) =>
      separateMessage({
        messageId: message.id,
        body: message.body,
        fromThreadId: message.thread_id,
        sessionId: liveClass.id,
        courseId: liveClass.course_id,
        teacherId: liveClass.teacher_id ?? null,
        studentLabel: studentName,
        stillAttached: myChats.filter(
          (row) => row.thread_id === message.thread_id && row.id !== message.id,
        ).length,
      }),
    onSuccess: () => {
      toast.success("Moved to its own discussion");
      queryClient.invalidateQueries({ queryKey: ["messages", liveClass.id] });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Could not separate this message"),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim().slice(0, 1000);
    if (!body || postMutation.isPending) return;
    setDraft("");
    if (quizMode) {
      answerMutation.mutate(body);
      return;
    }
    postMutation.mutate(body);
  }

  const statusMeta = {
    connecting: { label: "Connecting…", className: "text-muted-foreground" },
    live: { label: "Live", className: "text-success" },
    offline: { label: "Reconnecting…", className: "text-destructive" },
  } as const;
  const status = statusMeta[connection];

  /* Quiet thread the student joined but never rated → gentle follow-up. */
  const followUp =
    myThreads.find(
      (item) =>
        !myFeedback.has(item.thread.id) &&
        !dismissed.includes(item.thread.id) &&
        now - new Date(item.thread.last_activity_at).getTime() > FOLLOW_UP_MS,
    ) ?? null;

  /* answer-mode feedback stays available */
  const correctMessage =
    messages.find((message) => message.id === liveClass.pinned_message_id) ?? null;
  const correct = correctMessage?.message_type === "answer" ? correctMessage : null;
  const myAnswer = [...myMessages].reverse().find((m) => m.message_type === "answer");
  const iAmCorrect =
    correct && myAnswer ? answerKey(myAnswer.body) === answerKey(correct.body) : null;

  return (
    <div className="panel relative flex h-[75vh] flex-col overflow-hidden">
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

      {correct && (
        <div
          className={`border-b border-border px-5 py-3 ${
            iAmCorrect === null ? "bg-secondary" : iAmCorrect ? "bg-success/12" : "bg-destructive/10"
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
                  onClick={() => answerMutation.mutate(option)}
                  disabled={answerMutation.isPending}
                  className="rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-background disabled:opacity-50"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {myThreads.length > 0 && (
          <section className="space-y-2">
            <p className="text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
              Your discussions
            </p>
            {myThreads.map((item) => (
              <StudentThreadCard
                key={item.thread.id}
                item={item}
                voted={myVotes.has(item.thread.id)}
                feedback={myFeedback.get(item.thread.id) ?? null}
                onVote={(voted) => voteMutation.mutate({ threadId: item.thread.id, voted })}
                onFeedback={(state) => feedbackMutation.mutate({ threadId: item.thread.id, state })}
              />
            ))}
          </section>
        )}

        <section className="space-y-2">
          <p className="text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            Your messages
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : myChats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Type your question below — only you and your teacher see it.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...myChats].reverse().map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  stats={message.thread_id ? (statsById.get(message.thread_id) ?? null) : null}
                  busy={separateMutation.isPending}
                  onSeparate={() => separateMutation.mutate(message)}
                />
              ))}
            </ul>
          )}
          {postMutation.isPending && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-3.5" /> Merging your message…
            </p>
          )}
        </section>
      </div>

      {followUp && (
        <div className="absolute right-4 bottom-20 z-10 w-[min(20rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-4 shadow-lg">
          <p className="text-sm font-semibold">Did that answer your question?</p>
          <p className="mt-0.5 text-xs break-words text-muted-foreground">
            {followUp.thread.title}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                feedbackMutation.mutate({ threadId: followUp.thread.id, state: "resolved" })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-success/20 px-3 py-1.5 text-xs font-semibold text-success"
            >
              <CheckCircle2 className="size-3.5" /> Got It
            </button>
            <button
              onClick={() =>
                feedbackMutation.mutate({ threadId: followUp.thread.id, state: "need_help" })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive"
            >
              <HelpCircle className="size-3.5" /> Still Confused
            </button>
            <button
              onClick={() => setDismissed((list) => [...list, followUp.thread.id])}
              className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:underline"
            >
              Later
            </button>
          </div>
        </div>
      )}

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
          disabled={!draft.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
          Send
        </button>
      </form>
    </div>
  );
}

/** Every message the student sent is its own card showing where it landed. */
function MessageCard({
  message,
  stats,
  busy,
  onSeparate,
}: {
  message: ChatMessage;
  stats: ThreadStats | null;
  busy: boolean;
  onSeparate: () => void;
}) {
  const merged = !!stats && stats.students > 1;

  return (
    <li className="rounded-xl border border-border bg-accent/8 p-3">
      <p className="text-sm break-words">{message.body}</p>

      {stats && (
        <div className="mt-2 rounded-lg bg-secondary px-3 py-2">
          <p className="text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            {merged ? "Merged into" : "Your discussion"}
          </p>
          <p className="text-sm font-medium break-words">{stats.thread.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" /> Messaged by {stats.students}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowUp className="size-3.5" /> {stats.upvotes}
            </span>
          </p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-success">
          <CheckCircle2 className="size-3.5" />
          {merged ? "Auto-merged" : "Sent"}
        </span>
        <button
          onClick={onSeparate}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1 text-[0.68rem] font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <Split className="size-3.5" /> Separate Thread
        </button>
      </div>
    </li>
  );
}

function StudentThreadCard({
  item,
  voted,
  feedback,
  onVote,
  onFeedback,
}: {
  item: ThreadStats;
  voted: boolean;
  feedback: FeedbackState | null;
  onVote: (voted: boolean) => void;
  onFeedback: (state: FeedbackState | null) => void;
}) {
  const statusLabel =
    item.health === "settled"
      ? "Resolved"
      : item.health === "urgent"
        ? "Urgent"
        : item.health === "attention"
          ? "Needs attention"
          : "Waiting";

  return (
    <div
      className={`rounded-xl border border-border p-4 ${
        item.health === "settled" ? "opacity-60" : ""
      }`}
    >
      <h3 className="font-display text-sm font-semibold break-words">{item.thread.title}</h3>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">{statusLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Messaged by</dt>
          <dd className="font-medium">{item.students}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Upvotes</dt>
          <dd className="font-medium">{item.upvotes}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onVote(!voted)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            voted ? "bg-accent text-accent-foreground" : "border border-input hover:bg-secondary"
          }`}
        >
          <ArrowUp className="size-3.5" /> {voted ? "Upvoted" : "Upvote"}
        </button>
        <button
          onClick={() => onFeedback(feedback === "resolved" ? null : "resolved")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            feedback === "resolved"
              ? "bg-success/20 text-success"
              : "border border-input hover:bg-secondary"
          }`}
        >
          <CheckCircle2 className="size-3.5" /> Got It
        </button>
        <button
          onClick={() => onFeedback(feedback === "need_help" ? null : "need_help")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            feedback === "need_help"
              ? "bg-destructive/15 text-destructive"
              : "border border-input hover:bg-secondary"
          }`}
        >
          <HelpCircle className="size-3.5" /> Still Confused
        </button>
      </div>

      <p className="mt-2 text-[0.68rem] text-muted-foreground">
        {item.resolvedPct}% of responding students say they got it.
      </p>
    </div>
  );
}
