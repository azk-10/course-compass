import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUp,
  CheckCircle2,
  HelpCircle,
  MicOff,
  Pause,
  Send,
  Sparkles,
  Split,
  Users,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { useLiveMessages } from "@/hooks/useLiveMessages";
import { usePolls } from "@/hooks/usePolls";
import { useThreads } from "@/hooks/useThreads";
import { CATEGORY_META, toCategory, type Category } from "@/lib/classify";
import { sendMessage, setMessageCategory, studentsOnline, type ChatMessage } from "@/lib/live-chat";
import { classifyMessage } from "@/lib/merge.functions";
import { answerPoll, openPoll, shouldOpenAudioPoll, type Poll } from "@/lib/polls";
import {
  createThread,
  joinThread,
  reopenThread,
  separateMessage,
  setFeedback,
  setThreadCategory,
  setVote,
  topSimilarThreads,
  type FeedbackState,
  type Thread,
  type ThreadStats,
} from "@/lib/threads";
import { isBlocked, react, REACTIONS, type ReactionKind } from "@/lib/moderation";
import { useSessionPulse } from "@/hooks/useSessionPulse";
import { DEFAULT_SETTINGS, type ClassroomSettings } from "@/lib/settings";
import { logEvent } from "@/lib/logs";
import type { LiveClass } from "@/lib/student-chat";

/**
 * Students see a normal chat: sending is instant, classification and merging
 * happen silently behind the scenes. They keep full control of every message.
 */
export function StudentChat({
  liveClass,
  studentName,
  settings = DEFAULT_SETTINGS,
}: {
  liveClass: LiveClass;
  studentName: string;
  settings?: ClassroomSettings;
}) {
  const followUpMs = settings.followup_seconds * 1000;
  const confirmShare = settings.question_confirm_pct / 100;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [unsure, setUnsure] = useState<ChatMessage | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [myReaction, setMyReaction] = useState<ReactionKind | null>(null);
  const classify = useServerFn(classifyMessage);

  const { messages, isLoading, connection } = useLiveMessages(liveClass.id);
  const { threads, participants, votes, feedback, stats } = useThreads(
    liveClass.id,
    liveClass.resolve_threshold,
  );
  const { polls, responses } = usePolls(liveClass.id);
  const { blocks } = useSessionPulse(liveClass.id);
  const block = isBlocked(blocks, studentName);
  const removed = block?.kind === "remove";
  const muted = Boolean(block) && !removed;
  const locked = liveClass.chat_paused || Boolean(block);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const myMessages = messages.filter(
    (message) => !message.is_teacher && message.sender_label === studentName,
  );

  const myThreadIds = useMemo(
    () =>
      new Set(
        participants.filter((row) => row.student_label === studentName).map((row) => row.thread_id),
      ),
    [participants, studentName],
  );
  const myThreads = stats.filter(
    (item) => myThreadIds.has(item.thread.id) && item.category !== "spam",
  );
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

  /* --------------------- automatic classroom health checks -------------------- */

  const activeStudents = Math.max(studentsOnline(messages).length, 1);

  useEffect(() => {
    if (!shouldOpenAudioPoll(messages)) return;
    if (polls.some((poll) => poll.kind === "audio" && poll.status === "open")) return;
    void openPoll({
      sessionId: liveClass.id,
      kind: "audio",
      prompt: "Can you hear the teacher?",
    });
  }, [messages, polls, liveClass.id]);

  useEffect(() => {
    const popular = stats.find(
      (item) =>
        item.category === "question" &&
        item.thread.status === "open" &&
        item.students + item.upvotes >= Math.ceil(activeStudents * confirmShare) &&
        item.students >= 2,
    );
    if (!popular) return;
    if (polls.some((poll) => poll.thread_id === popular.thread.id)) return;
    void openPoll({
      sessionId: liveClass.id,
      kind: "question_confirm",
      threadId: popular.thread.id,
      prompt: popular.thread.title,
    });
  }, [stats, polls, activeStudents, confirmShare, liveClass.id]);

  const answeredPolls = new Set(
    responses.filter((row) => row.student_label === studentName).map((row) => row.poll_id),
  );
  const activePoll =
    polls.find((poll) => {
      if (poll.status !== "open" || answeredPolls.has(poll.id)) return false;
      // Never interrupt students who already joined the discussion in question.
      if (poll.thread_id && myThreadIds.has(poll.thread_id)) return false;
      return true;
    }) ?? null;

  /* -------------------------------- mutations ------------------------------- */

  /** Auto-merge: candidates are shortlisted locally, then judged by AI. */
  const postMutation = useMutation({
    mutationFn: async (body: string) => {
      const candidates = topSimilarThreads(body, threads, 6).map((row) => ({
        id: row.thread.id,
        title: row.thread.title,
        category: row.thread.category,
      }));

      const verdict = await classify({ data: { draft: body, candidates } });
      const category = toCategory(verdict.category);
      const matched = threads.find((thread) => thread.id === verdict.threadId) ?? null;

      const thread =
        matched ??
        (await createThread({
          sessionId: liveClass.id,
          courseId: liveClass.course_id,
          teacherId: liveClass.teacher_id ?? null,
          title: verdict.title || body,
          studentLabel: studentName,
          category,
        }));

      if (matched) {
        await joinThread({
          threadId: thread.id,
          sessionId: liveClass.id,
          studentLabel: studentName,
        });
        if (matched.status !== "open") await reopenThread(matched.id);
      }

      const message = await sendMessage({
        sessionId: liveClass.id,
        courseId: liveClass.course_id,
        senderLabel: studentName,
        body,
        threadId: thread.id,
        category,
        confidence: verdict.confidence,
      });

      return { message, category, confidence: verdict.confidence };
    },
    onSuccess: (result) => {
      // Only a genuine question/answer ambiguity is worth interrupting for.
      if (
        result.confidence < 0.5 &&
        (result.category === "question" ||
          result.category === "answer" ||
          result.category === "general")
      ) {
        setUnsure(result.message);
      }
      refresh();
    },
    onError: (error: Error) => {
      logEvent({
        kind: "ai_failure",
        sessionId: liveClass.id,
        detail: { message: error.message },
      });
      toast.error(error.message || "Could not send your message");
    },
  });

  const clarifyMutation = useMutation({
    mutationFn: async (input: { message: ChatMessage; category: Category }) => {
      await setMessageCategory(input.message.id, input.category);
      if (input.message.thread_id) {
        await setThreadCategory(input.message.thread_id, input.category);
      }
    },
    onSuccess: () => {
      setUnsure(null);
      queryClient.invalidateQueries({ queryKey: ["messages", liveClass.id] });
      refresh();
    },
  });

  const pollMutation = useMutation({
    mutationFn: async (input: { poll: Poll; answer: "yes" | "no" }) => {
      await answerPoll({
        pollId: input.poll.id,
        sessionId: liveClass.id,
        studentLabel: studentName,
        answer: input.answer,
      });
      // "Yes, I have this question too" adds the student without typing.
      if (
        input.poll.kind === "question_confirm" &&
        input.poll.thread_id &&
        input.answer === "yes"
      ) {
        await joinThread({
          threadId: input.poll.thread_id,
          sessionId: liveClass.id,
          studentLabel: studentName,
        });
      }
    },
    onSuccess: refresh,
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

  const reactionMutation = useMutation({
    mutationFn: (kind: ReactionKind) =>
      react({ sessionId: liveClass.id, label: studentName, kind }),
    onMutate: (kind) => setMyReaction(kind),
    onError: () => toast.error("Could not send that reaction"),
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
        category: toCategory(message.category),
        stillAttached: myMessages.filter(
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

  const cooldownLeft = Math.max(0, cooldownUntil - now);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim().slice(0, 1000);
    if (!body || postMutation.isPending) return;
    if (locked) return;
    if (Date.now() < cooldownUntil) {
      toast.info("Slow down a moment — one message at a time.");
      return;
    }
    setCooldownUntil(Date.now() + settings.cooldown_ms);
    setDraft("");
    postMutation.mutate(body);
  }

  const statusMeta = {
    connecting: { label: "Connecting…", className: "text-muted-foreground" },
    live: { label: "Live", className: "text-success" },
    offline: { label: "Reconnecting…", className: "text-destructive" },
  } as const;
  const status = statusMeta[connection];

  /* Quiet question thread the student joined but never rated → gentle follow-up. */
  const followUp =
    myThreads.find(
      (item) =>
        item.category === "question" &&
        !myFeedback.has(item.thread.id) &&
        !dismissed.includes(item.thread.id) &&
        now - new Date(item.thread.last_activity_at).getTime() > followUpMs,
    ) ?? null;

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
          ) : myMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Type anything — a question, an answer or an issue. Only you and your teacher see it.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...myMessages].reverse().map((message) => (
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

      {unsure && (
        <Popup title="What is this message?" subtitle={unsure.body}>
          <PopupButton
            tone="neutral"
            onClick={() => clarifyMutation.mutate({ message: unsure, category: "question" })}
          >
            Question
          </PopupButton>
          <PopupButton
            tone="neutral"
            onClick={() => clarifyMutation.mutate({ message: unsure, category: "answer" })}
          >
            Answer
          </PopupButton>
        </Popup>
      )}

      {!unsure && activePoll && (
        <Popup
          title={
            activePoll.kind === "audio"
              ? "Can you hear the teacher?"
              : "Do you also have this question?"
          }
          subtitle={activePoll.kind === "audio" ? undefined : activePoll.prompt}
          icon={
            activePoll.kind === "audio" ? <Volume2 className="size-4 text-warning" /> : undefined
          }
        >
          <PopupButton
            tone="good"
            onClick={() => pollMutation.mutate({ poll: activePoll, answer: "yes" })}
          >
            Yes
          </PopupButton>
          <PopupButton
            tone="bad"
            onClick={() => pollMutation.mutate({ poll: activePoll, answer: "no" })}
          >
            No
          </PopupButton>
        </Popup>
      )}

      {!unsure && !activePoll && followUp && (
        <Popup title="Did that answer your question?" subtitle={followUp.thread.title}>
          <PopupButton
            tone="good"
            onClick={() =>
              feedbackMutation.mutate({ threadId: followUp.thread.id, state: "resolved" })
            }
          >
            <CheckCircle2 className="size-3.5" /> Got It
          </PopupButton>
          <PopupButton
            tone="bad"
            onClick={() =>
              feedbackMutation.mutate({ threadId: followUp.thread.id, state: "need_help" })
            }
          >
            <HelpCircle className="size-3.5" /> Still Confused
          </PopupButton>
          <button
            onClick={() => setDismissed((list) => [...list, followUp.thread.id])}
            className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:underline"
          >
            Later
          </button>
        </Popup>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-border px-4 pt-3">
        {REACTIONS.map((reaction) => {
          const active = myReaction === reaction.kind;
          return (
            <button
              key={reaction.kind}
              type="button"
              disabled={locked}
              onClick={() => reactionMutation.mutate(reaction.kind)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95 disabled:opacity-40 ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "border border-input hover:bg-secondary"
              }`}
            >
              <span aria-hidden>{reaction.emoji}</span>
              {reaction.label}
            </button>
          );
        })}
      </div>

      {locked && (
        <p className="flex items-center gap-2 px-4 pt-3 text-xs font-medium text-warning">
          {removed ? (
            <>
              <MicOff className="size-3.5" /> Your teacher removed you from this session.
            </>
          ) : muted ? (
            <>
              <MicOff className="size-3.5" /> You are muted for a few minutes.
            </>
          ) : (
            <>
              <Pause className="size-3.5" /> Your teacher paused the chat.
            </>
          )}
        </p>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border px-4 py-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          disabled={locked}
          placeholder={locked ? "Chat unavailable right now" : "Type a message…"}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!draft.trim() || locked || cooldownLeft > 0}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
          {cooldownLeft > 0 ? `${Math.ceil(cooldownLeft / 1000)}s` : "Send"}
        </button>
      </form>
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function Popup({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute right-4 bottom-20 z-10 w-[min(20rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-4 shadow-lg">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </p>
      {subtitle && (
        <p className="mt-0.5 line-clamp-2 text-xs break-words text-muted-foreground">{subtitle}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function PopupButton({
  tone,
  onClick,
  children,
}: {
  tone: "good" | "bad" | "neutral";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const styles = {
    good: "bg-success/20 text-success",
    bad: "bg-destructive/15 text-destructive",
    neutral: "border border-input hover:bg-secondary",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${styles}`}
    >
      {children}
    </button>
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
  const meta = CATEGORY_META[toCategory(message.category)];

  return (
    <li className="rounded-xl border border-border bg-accent/8 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm break-words">{message.body}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${meta.chip}`}
        >
          {meta.label}
        </span>
      </div>

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
  const meta = CATEGORY_META[item.category];
  // Only questions can be "understood" — answers and issues need no rating.
  const rateable = item.category === "question";
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
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold break-words">{item.thread.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${meta.chip}`}
        >
          {meta.label}
        </span>
      </div>
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
        {rateable && (
          <>
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
          </>
        )}
      </div>

      {rateable && (
        <p className="mt-2 text-[0.68rem] text-muted-foreground">
          {item.resolvedPct}% of responding students say they got it.
        </p>
      )}
    </div>
  );
}
