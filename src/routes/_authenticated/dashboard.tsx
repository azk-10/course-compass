import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Play, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CourseSidebar } from "@/components/dashboard/CourseSidebar";
import { AnswerGroups } from "@/components/dashboard/AnswerGroups";
import { ThreadBoard } from "@/components/dashboard/ThreadBoard";
import { ModeControls } from "@/components/dashboard/ModeControls";
import { NewCourseDialog } from "@/components/dashboard/NewCourseDialog";
import { StudentApprovals } from "@/components/dashboard/StudentApprovals";
import {
  QuickStats,
  StudentsOnline,
  ThreadSettings,
  TopThread,
} from "@/components/dashboard/SessionRail";
import { useLiveMessages } from "@/hooks/useLiveMessages";
import { useThreads } from "@/hooks/useThreads";
import { groupAnswers } from "@/lib/grouping";
import { studentsOnline } from "@/lib/live-chat";

import {
  createCourse,
  deleteCourse,
  endSession,
  fetchCourses,
  fetchEnrollments,
  fetchSessions,
  setCourseArchived,
  setEnrollmentStatus,
  setPinnedMessage,
  setQuiz,
  setResolveThreshold,
  setSessionMode,
  startSession,
  type AnswerType,
  type SessionMode,
} from "@/lib/dashboard-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Teacher dashboard — Course Compass" },
      {
        name: "description",
        content:
          "Run your live class chat next to Zoom: one live session, a fast message feed, student approvals and a highlighted current discussion.",
      },
      { property: "og:title", content: "Teacher dashboard — Course Compass" },
      {
        property: "og:description",
        content: "A calm live chat companion for very large online classes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const courses = coursesQuery.data ?? [];
  const activeId = courseId ?? courses[0]?.id ?? null;
  const activeCourse = courses.find((course) => course.id === activeId) ?? null;
  const isArchived = activeCourse?.status === "archived";

  const sessionsQuery = useQuery({
    queryKey: ["sessions", activeId],
    queryFn: () => fetchSessions(activeId!),
    enabled: !!activeId,
  });
  const sessions = sessionsQuery.data ?? [];
  const session = sessions.find((item) => item.status === "live") ?? null;

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", activeId],
    queryFn: () => fetchEnrollments(activeId!),
    enabled: !!activeId,
  });
  const enrollments = enrollmentsQuery.data ?? [];

  const { messages, isLoading: messagesLoading, connection } = useLiveMessages(session?.id ?? null);
  const online = studentsOnline(messages);
  const threshold = session?.resolve_threshold ?? 75;
  const { stats: threadStats, isLoading: threadsLoading } = useThreads(
    session?.id ?? null,
    threshold,
  );
  const topThread = threadStats.find((item) => item.health !== "settled") ?? null;
  const answerGroups = useMemo(() => groupAnswers(messages), [messages]);

  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`enrollments-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "enrollments",
          filter: `course_id=eq.${activeId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["enrollments", activeId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, queryClient]);

  const invalidateSessions = () =>
    queryClient.invalidateQueries({ queryKey: ["sessions", activeId] });

  const startMutation = useMutation({
    mutationFn: () =>
      startSession({
        courseId: activeId!,
        title: sessionTitle.trim() || `Session ${sessions.length + 1}`,
      }),
    onSuccess: () => {
      setSessionTitle("");
      invalidateSessions();
      toast.success("Session started");
    },
    onError: () => toast.error("Could not start the session"),
  });

  const endMutation = useMutation({
    mutationFn: () => endSession(session!.id),
    onSuccess: () => {
      invalidateSessions();
      toast.success("Session ended");
    },
    onError: () => toast.error("Could not end the session"),
  });

  const modeMutation = useMutation({
    mutationFn: (mode: SessionMode) => setSessionMode(session!.id, mode),
    onSuccess: invalidateSessions,
    onError: () => toast.error("Could not switch mode"),
  });

  const quizMutation = useMutation({
    mutationFn: (input: { prompt: string; answerType: AnswerType; options: string[] }) =>
      setQuiz({ sessionId: session!.id, ...input }),
    onSuccess: () => {
      invalidateSessions();
      toast.success("Question sent to students");
    },
    onError: () => toast.error("Could not push the question"),
  });

  const pinMutation = useMutation({
    mutationFn: (messageId: string | null) => setPinnedMessage(session!.id, messageId),
    onSuccess: invalidateSessions,
    onError: () => toast.error("Could not highlight the message"),
  });

  const createCourseMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setCourseId(course.id);
      setNewCourseOpen(false);
      toast.success(course.is_crash ? "Crash course created" : "Course created");
    },
    onError: () => toast.error("Could not create the course"),
  });

  const archiveMutation = useMutation({
    mutationFn: async (archived: boolean) => {
      if (archived && session) await endSession(session.id);
      await setCourseArchived(activeId!, archived);
      return archived;
    },
    onSuccess: (archived) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      invalidateSessions();
      toast.success(archived ? "Course archived" : "Course restored");
    },
    onError: () => toast.error("Could not update the course"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCourse(activeId!),
    onSuccess: () => {
      setCourseId(null);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted with all enrolled students");
    },
    onError: () => toast.error("Could not delete the course"),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "declined" }) =>
      setEnrollmentStatus(id, status),
    onMutate: ({ id }) => setDecidingId(id),
    onSettled: () => setDecidingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrollments", activeId] }),
    onError: () => toast.error("Could not update the student"),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const connectionLabel =
    connection === "live" ? "Live" : connection === "connecting" ? "Connecting…" : "Reconnecting…";

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <CourseSidebar
        courses={courses}
        activeId={activeId}
        onSelect={setCourseId}
        onAddCourse={() => setNewCourseOpen(true)}
        onSignOut={handleSignOut}
        email={email}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
              {activeCourse?.title ?? "Course Compass"}
              {activeCourse?.is_crash && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.62rem] tracking-normal text-foreground normal-case">
                  <Zap className="size-3 text-accent" /> Crash course
                </span>
              )}
              {isArchived && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.62rem] tracking-normal text-foreground normal-case">
                  Archived
                </span>
              )}
            </p>
            <h1 className="mt-1 flex min-w-0 items-center gap-2 truncate font-display text-xl font-semibold">
              {session ? session.title : "No live session"}
              {session && (
                <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent capitalize">
                  {session.mode === "quiz" ? "Answer mode" : "Question mode"}
                </span>
              )}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {session && (
              <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex">
                {connection === "live" && <span className="live-dot" />}
                {connectionLabel}
              </span>
            )}
            {activeCourse && (
              <>
                <button
                  onClick={() => archiveMutation.mutate(!isArchived)}
                  disabled={archiveMutation.isPending}
                  aria-label={isArchived ? "Restore course" : "Archive course"}
                  className="rounded-lg border border-input p-2 transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  {isArchived ? (
                    <ArchiveRestore className="size-4" />
                  ) : (
                    <Archive className="size-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this course and remove all enrolled students?"))
                      deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                  aria-label="Delete course"
                  className="rounded-lg border border-input p-2 text-destructive transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        </header>

        {session ? (
          <>
            {session.mode === "quiz" && session.quiz_prompt && (
              <div className="border-b border-border bg-accent/10 px-4 py-3 sm:px-6">
                <p className="text-[0.68rem] tracking-[0.14em] text-accent uppercase">
                  Answer mode · {session.quiz_answer_type?.replace("_", " ")}
                </p>
                <p className="text-sm font-medium">{session.quiz_prompt}</p>
              </div>
            )}
            {session.mode === "quiz" ? (
              <AnswerGroups
                groups={answerGroups}
                isLoading={messagesLoading}
                correctId={session.pinned_message_id}
                onMarkCorrect={(group) =>
                  pinMutation.mutate(
                    group.messages.some((m) => m.id === session.pinned_message_id)
                      ? null
                      : group.representativeId,
                  )
                }
              />
            ) : (
              <ThreadBoard
                stats={threadStats}
                messages={messages}
                isLoading={threadsLoading || messagesLoading}
              />
            )}
            <ModeControls
              session={session}
              busy={modeMutation.isPending || endMutation.isPending}
              onMode={(mode) => modeMutation.mutate(mode)}
              onQuiz={(input) => quizMutation.mutate(input)}
              onEnd={() => endMutation.mutate()}
            />
          </>

        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
            <div className="mx-auto w-full max-w-xl space-y-6">
              <div className="panel p-6">
                <h2 className="font-display text-lg font-semibold">Start a session</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Students in this course enter automatically once you go live. Only one session
                  can be live at a time.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    startMutation.mutate();
                  }}
                  className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2"
                >
                  <input
                    value={sessionTitle}
                    onChange={(event) => setSessionTitle(event.target.value)}
                    maxLength={60}
                    placeholder="Day 1, Momentum Revision…"
                    className="h-10 min-w-0 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={!activeId || isArchived || startMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                  >
                    <Play className="size-4" /> Start Session
                  </button>
                </form>
              </div>

              <div className="panel p-6">
                <h3 className="font-display text-sm font-semibold">Past sessions</h3>
                {sessions.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No sessions yet.</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {sessions.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2 text-sm"
                      >
                        <span className="truncate">{item.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(item.started_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <aside className="w-full shrink-0 space-y-4 border-border p-4 lg:h-screen lg:w-80 lg:overflow-y-auto lg:border-l">
        <TopThread item={topThread} />
        <StudentsOnline names={online} />
        <StudentApprovals
          enrollments={enrollments}
          pendingId={decidingId}
          onDecide={(id, status) => decideMutation.mutate({ id, status })}
        />
        {session && (
          <ThreadSettings
            threshold={threshold}
            disabled={thresholdMutation.isPending}
            onChange={(value) => thresholdMutation.mutate(value)}
          />
        )}
        <QuickStats
          messages={messages}
          online={online.length}
          session={session}
          stats={threadStats}
        />
      </aside>

      <NewCourseDialog
        open={newCourseOpen}
        pending={createCourseMutation.isPending}
        onClose={() => setNewCourseOpen(false)}
        onCreate={(input) => createCourseMutation.mutate(input)}
      />
    </div>
  );
}
