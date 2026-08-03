import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Play, Square, Zap } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CourseSidebar } from "@/components/dashboard/CourseSidebar";
import { QuestionGroups } from "@/components/dashboard/QuestionGroups";
import { LiveStats } from "@/components/dashboard/LiveStats";
import { NewCourseDialog } from "@/components/dashboard/NewCourseDialog";
import { StudentApprovals } from "@/components/dashboard/StudentApprovals";
import {
  createCourse,
  endSession,
  fetchEnrollments,
  setCourseArchived,
  setEnrollmentStatus,
  fetchCourses,
  fetchGroups,
  fetchLiveSession,
  fetchResponses,
  recordResponse,
  startSession,
} from "@/lib/dashboard-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Teacher dashboard — Lecture Pulse" },
      {
        name: "description",
        content:
          "Manage courses, grouped questions and live class sessions with real-time response statistics.",
      },
      { property: "og:title", content: "Teacher dashboard — Lecture Pulse" },
      {
        property: "og:description",
        content: "Courses, grouped questions and live response statistics in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const STUDENTS = ["Ada", "Bruno", "Chen", "Dara", "Eli", "Fay", "Gus", "Hana"];

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const courses = coursesQuery.data ?? [];
  const activeId = courseId ?? courses[0]?.id ?? null;
  const activeCourse = courses.find((c) => c.id === activeId) ?? null;
  const isArchived = activeCourse?.status === "archived";

  const groupsQuery = useQuery({
    queryKey: ["groups", activeId],
    queryFn: () => fetchGroups(activeId!),
    enabled: !!activeId,
  });
  const groups = groupsQuery.data ?? [];

  const sessionQuery = useQuery({
    queryKey: ["session", activeId],
    queryFn: () => fetchLiveSession(activeId!),
    enabled: !!activeId,
  });
  const session = sessionQuery.data ?? null;

  const responsesQuery = useQuery({
    queryKey: ["responses", session?.id],
    queryFn: () => fetchResponses(session!.id),
    enabled: !!session?.id,
  });
  const responses = responsesQuery.data ?? [];

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", activeId],
    queryFn: () => fetchEnrollments(activeId!),
    enabled: !!activeId,
  });
  const enrollments = enrollmentsQuery.data ?? [];

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
        () => {
          queryClient.invalidateQueries({ queryKey: ["enrollments", activeId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, queryClient]);

  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase
      .channel(`responses-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "responses",
          filter: `session_id=eq.${session.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["responses", session.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id, queryClient]);

  const startMutation = useMutation({
    mutationFn: () => startSession(activeId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", activeId] });
      toast.success("Session started");
    },
    onError: () => toast.error("Could not start the session"),
  });

  const endMutation = useMutation({
    mutationFn: () => endSession(session!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", activeId] });
      toast.success("Session ended");
    },
    onError: () => toast.error("Could not end the session"),
  });

  const askMutation = useMutation({
    mutationFn: (questionId: string) =>
      recordResponse({
        sessionId: session!.id,
        questionId,
        studentLabel: STUDENTS[Math.floor(Math.random() * STUDENTS.length)]!,
        isCorrect: Math.random() > 0.35,
      }),
    onError: () => toast.error("Could not record the response"),
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
      queryClient.invalidateQueries({ queryKey: ["session", activeId] });
      toast.success(archived ? "Course archived" : "Course restored");
    },
    onError: () => toast.error("Could not update the course"),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "declined" }) =>
      setEnrollmentStatus(id, status),
    onMutate: ({ id }) => setDecidingId(id),
    onSettled: () => setDecidingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments", activeId] });
    },
    onError: () => toast.error("Could not update the student"),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <CourseSidebar
        courses={courses}
        activeId={activeId}
        onSelect={setCourseId}
        onAddCourse={() => setNewCourseOpen(true)}
        onSignOut={handleSignOut}
        email={email}
      />

      <main className="min-w-0 flex-1 px-5 py-8 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs tracking-[0.16em] text-muted-foreground uppercase">
              {activeCourse?.term ?? "Dashboard"}
              {activeCourse?.is_crash && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.62rem] text-foreground">
                  <Zap className="size-3 text-accent" /> Crash course
                </span>
              )}
              {isArchived && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.62rem] text-foreground">
                  Archived
                </span>
              )}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold">
              {activeCourse?.title ?? "Your courses"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
          {activeCourse && (
            <button
              onClick={() => archiveMutation.mutate(!isArchived)}
              disabled={archiveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {isArchived ? (
                <>
                  <ArchiveRestore className="size-4" /> Restore
                </>
              ) : (
                <>
                  <Archive className="size-4" /> Archive
                </>
              )}
            </button>
          )}
          {session ? (
            <button
              onClick={() => endMutation.mutate()}
              disabled={endMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <Square className="size-4" /> End session
            </button>
          ) : (
            <button
              onClick={() => startMutation.mutate()}
              disabled={!activeId || isArchived || startMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-lift)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              <Play className="size-4" /> Start Session
            </button>
          )}
          </div>
        </header>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_20rem]">
          <div>
            {groupsQuery.isLoading ? (
              <div className="panel p-8 text-sm text-muted-foreground">Loading questions…</div>
            ) : (
              <QuestionGroups
                groups={groups}
                responses={responses}
                liveSessionId={session?.id ?? null}
                onAsk={(id) => askMutation.mutate(id)}
              />
            )}
          </div>
          <div className="space-y-6">
            <LiveStats session={session} responses={responses} groups={groups} />
            <StudentApprovals
              enrollments={enrollments}
              pendingId={decidingId}
              onDecide={(id, status) => decideMutation.mutate({ id, status })}
            />
          </div>
        </div>
      </main>

      <NewCourseDialog
        open={newCourseOpen}
        pending={createCourseMutation.isPending}
        onClose={() => setNewCourseOpen(false)}
        onCreate={(input) => createCourseMutation.mutate(input)}
      />
    </div>
  );
}
