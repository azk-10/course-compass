import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Compass,
  Play,
  Square,
  Trash2,
  Volume2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ChatTabList, RawChatList, type ChatTab } from "@/components/dashboard/RawChatPanel";
import { ThreadBoard } from "@/components/dashboard/ThreadBoard";
import { StudentApprovals } from "@/components/dashboard/StudentApprovals";
import {
  QuickStats,
  StudentsOnline,
  ThreadSettings,
  TopThread,
} from "@/components/dashboard/SessionRail";
import { useLiveMessages } from "@/hooks/useLiveMessages";
import { usePolls } from "@/hooks/usePolls";
import { useThreads } from "@/hooks/useThreads";
import { studentsOnline } from "@/lib/live-chat";
import { pollVerdict } from "@/lib/polls";
import {
  deleteCourse,
  endSession,
  fetchCourses,
  fetchEnrollments,
  fetchSessions,
  setCourseArchived,
  setEnrollmentStatus,
  setResolveThreshold,
  startSession,
} from "@/lib/dashboard-data";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Live course — Course Compass" },
      {
        name: "description",
        content:
          "Run one course beside Zoom: merged discussion threads, the raw class chat, student approvals and live classroom statistics.",
      },
      { property: "og:title", content: "Live course — Course Compass" },
      {
        property: "og:description",
        content: "Merged classroom intent, raw chat and approvals in one live view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CourseDashboard,
});

function CourseDashboard() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [chatTab, setChatTab] = useState<ChatTab>("topics");

  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const activeCourse = coursesQuery.data?.find((course) => course.id === courseId) ?? null;
  const isArchived = activeCourse?.status === "archived";

  const sessionsQuery = useQuery({
    queryKey: ["sessions", courseId],
    queryFn: () => fetchSessions(courseId),
  });
  const sessions = sessionsQuery.data ?? [];
  const session = sessions.find((item) => item.status === "live") ?? null;

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", courseId],
    queryFn: () => fetchEnrollments(courseId),
  });
  const enrollments = enrollmentsQuery.data ?? [];

  const { messages, isLoading: messagesLoading, connection } = useLiveMessages(session?.id ?? null);
  const online = studentsOnline(messages);
  const threshold = session?.resolve_threshold ?? 75;

  const { polls, responses } = usePolls(session?.id ?? null);
  const audioPoll = polls.find((poll) => poll.kind === "audio") ?? null;
  const audioAlert = audioPoll ? pollVerdict(audioPoll, responses).majorityNo : false;

  const { stats: threadStats, isLoading: threadsLoading } = useThreads(
    session?.id ?? null,
    threshold,
    audioAlert,
  );
  const topThread = threadStats.find((item) => item.health !== "settled") ?? null;

  useEffect(() => {
    const channel = supabase
      .channel(`enrollments-${courseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "enrollments", filter: `course_id=eq.${courseId}` },
        () => queryClient.invalidateQueries({ queryKey: ["enrollments", courseId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [courseId, queryClient]);

  const invalidateSessions = () =>
    queryClient.invalidateQueries({ queryKey: ["sessions", courseId] });

  const startMutation = useMutation({
    mutationFn: () =>
      startSession({
        courseId,
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

  const thresholdMutation = useMutation({
    mutationFn: (value: number) => setResolveThreshold(session!.id, value),
    onSuccess: invalidateSessions,
    onError: () => toast.error("Could not save the setting"),
  });

  const archiveMutation = useMutation({
    mutationFn: async (archived: boolean) => {
      if (archived && session) await endSession(session.id);
      await setCourseArchived(courseId, archived);
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
    mutationFn: () => deleteCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted with all enrolled students");
      navigate({ to: "/courses" });
    },
    onError: () => toast.error("Could not delete the course"),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "declined" }) =>
      setEnrollmentStatus(id, status),
    onMutate: ({ id }) => setDecidingId(id),
    onSettled: () => setDecidingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrollments", courseId] }),
    onError: () => toast.error("Could not update the student"),
  });

  const connectionLabel =
    connection === "live" ? "Live" : connection === "connecting" ? "Connecting…" : "Reconnecting…";

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="flex w-full shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:h-screen lg:w-80">
        <div className="flex items-center gap-2 px-5 py-5 font-display text-base font-semibold">
          <Compass className="size-5 text-sidebar-primary" />
          Course Compass
        </div>

        <button
          onClick={() => navigate({ to: "/courses" })}
          className="mx-3 mb-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium opacity-80 transition-colors hover:bg-sidebar-accent hover:opacity-100"
        >
          <ArrowLeft className="size-4" /> All courses
        </button>

        <div className="px-5 pb-3">
          <p className="text-[0.62rem] tracking-[0.16em] uppercase opacity-60">Raw class chat</p>
          <p className="mt-1 text-xs opacity-60">
            Everything students typed, exactly as sent — including filtered spam.
          </p>
        </div>

        <RawChatPanel messages={messages} />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
              {activeCourse?.title ?? "Course"}
              {activeCourse && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.62rem] tracking-[0.14em] text-foreground">
                  Code {activeCourse.join_code}
                </span>
              )}
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
                <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                  Live chat
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
            <button
              onClick={() => archiveMutation.mutate(!isArchived)}
              disabled={archiveMutation.isPending}
              aria-label={isArchived ? "Restore course" : "Archive course"}
              className="rounded-lg border border-input p-2 transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
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
          </div>
        </header>

        {session ? (
          <>
            {audioAlert && (
              <div className="flex items-center gap-2 border-b border-border bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive sm:px-6">
                <Volume2 className="size-4" />
                Most students say they cannot hear you — check your microphone.
              </div>
            )}
            <ThreadBoard
              stats={threadStats}
              messages={messages}
              isLoading={threadsLoading || messagesLoading}
            />
            <div className="flex justify-end border-t border-border bg-card px-4 py-3 sm:px-6">
              <button
                onClick={() => endMutation.mutate()}
                disabled={endMutation.isPending}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
              >
                <Square className="size-4" /> End Session
              </button>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
            <div className="mx-auto w-full max-w-xl space-y-6">
              <div className="panel p-6">
                <h2 className="font-display text-lg font-semibold">Start a session</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Approved students in this course enter automatically once you go live. Only one
                  session can be live at a time.
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
                    disabled={isArchived || startMutation.isPending}
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
    </div>
  );
}
