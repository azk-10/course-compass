import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
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
import { QuickStats, StudentsOnline, TopThread } from "@/components/dashboard/SessionRail";
import { ClassPulse } from "@/components/dashboard/ClassPulse";
import { ClassroomSettingsPanel } from "@/components/dashboard/ClassroomSettingsPanel";
import { SafetyMenu } from "@/components/dashboard/SafetyMenu";
import { useSessionPulse } from "@/hooks/useSessionPulse";
import { fetchMyProfile } from "@/lib/org";
import { readDevMode, setDevMode } from "@/lib/logs";
import {
  liftBlock,
  muteStudent,
  removeStudent,
  setChatPaused,
} from "@/lib/moderation";
import {
  DEFAULT_SETTINGS,
  fetchSettings,
  saveSettings,
  type ClassroomSettings,
} from "@/lib/settings";
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
  const [railOpen, setRailOpen] = useState(false);
  const [railWidth, setRailWidth] = useState(240);
  const [isDesktop, setIsDesktop] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [settingsLevel, setSettingsLevel] = useState<"org" | "teacher">("teacher");
  const [devMode, setDev] = useState(false);

  useEffect(() => setDev(readDevMode()), []);

  // Restore the teacher's last sidebar state (open/closed + width).
  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);

    const savedOpen = localStorage.getItem("cc:rail-open");
    setRailOpen(savedOpen === null ? window.innerWidth >= 1024 : savedOpen === "1");
    const savedWidth = Number(localStorage.getItem("cc:rail-width"));
    if (savedWidth >= 180 && savedWidth <= 420) setRailWidth(savedWidth);

    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    localStorage.setItem("cc:rail-open", railOpen ? "1" : "0");
  }, [railOpen]);

  // Drag-to-resize the sidebar on pointer devices.
  useEffect(() => {
    if (!resizing) return;
    const move = (event: PointerEvent) => {
      const next = Math.min(420, Math.max(180, event.clientX));
      setRailWidth(next);
    };
    const stop = () => {
      setResizing(false);
      setRailWidth((width) => {
        localStorage.setItem("cc:rail-width", String(width));
        return width;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [resizing]);


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

  const { blocks, reactions } = useSessionPulse(session?.id ?? null);

  const profileQuery = useQuery({ queryKey: ["my-profile"], queryFn: fetchMyProfile });
  const profile = profileQuery.data ?? null;
  const isStaff = profile?.role === "owner" || profile?.role === "admin";

  useEffect(() => {
    if (isStaff) setSettingsLevel("org");
  }, [isStaff]);

  const settingsQuery = useQuery({
    queryKey: ["classroom-settings", profile?.id, profile?.organization_id],
    queryFn: () =>
      fetchSettings({
        organizationId: profile?.organization_id ?? null,
        teacherId: profile!.id,
      }),
    enabled: Boolean(profile?.id),
  });
  const settings: ClassroomSettings = settingsQuery.data ?? DEFAULT_SETTINGS;

  const settingsMutation = useMutation({
    mutationFn: async (patch: Partial<ClassroomSettings>) => {
      if (!profile) return;
      await saveSettings(
        {
          organizationId: profile.organization_id,
          teacherId: profile.id,
          level: settingsLevel,
        },
        patch,
      );
      if (patch.resolve_pct !== undefined && session) {
        await setResolveThreshold(session.id, patch.resolve_pct);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-settings"] });
      invalidateSessions();
    },
    onError: () => toast.error("Could not save the setting"),
  });

  const safetyMutation = useMutation({
    mutationFn: async (
      action:
        | { type: "pause"; paused: boolean }
        | { type: "mute"; label: string; minutes: number }
        | { type: "remove"; label: string }
        | { type: "lift"; label: string },
    ) => {
      if (!session || !profile) return;
      const base = { sessionId: session.id, teacherId: profile.id };
      if (action.type === "pause") return setChatPaused(session.id, action.paused, profile.id);
      if (action.type === "mute")
        return muteStudent({ ...base, label: action.label, minutes: action.minutes });
      if (action.type === "remove") return removeStudent({ ...base, label: action.label });
      return liftBlock({ ...base, label: action.label });
    },
    onSuccess: (_data, action) => {
      invalidateSessions();
      queryClient.invalidateQueries({ queryKey: ["blocks", session?.id] });
      toast.success(
        action.type === "pause"
          ? action.paused
            ? "Chat paused"
            : "Chat resumed"
          : action.type === "mute"
            ? `${action.label} muted`
            : action.type === "remove"
              ? `${action.label} removed`
              : "Restriction lifted",
      );
    },
    onError: () => toast.error("Could not apply that control"),
  });

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
    <div className="flex min-h-screen flex-row sm:h-screen sm:overflow-hidden">
      {railOpen && (
        <>
          <div className="w-14 shrink-0 sm:hidden" />
          <button
            aria-label="Close chat tabs"
            onClick={() => setRailOpen(false)}
            className="fixed inset-0 z-30 bg-foreground/40 sm:hidden"
          />
        </>
      )}
      <aside
        style={railOpen && isDesktop ? { width: railWidth } : undefined}
        className={`relative z-40 flex shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground sm:static sm:h-screen ${
          resizing ? "" : "transition-[width] duration-300 ease-out"
        } ${
          railOpen ? "fixed inset-y-0 left-0 w-60 shadow-xl" : "w-14 border-r border-sidebar-accent/40"
        }`}
      >
        {railOpen && isDesktop && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onPointerDown={(event) => {
              event.preventDefault();
              setResizing(true);
            }}
            onDoubleClick={() => {
              setRailWidth(240);
              localStorage.setItem("cc:rail-width", "240");
            }}
            className={`absolute inset-y-0 right-0 z-50 w-1.5 cursor-col-resize transition-colors ${
              resizing ? "bg-sidebar-primary" : "hover:bg-sidebar-primary/60"
            }`}
          />
        )}

        <div
          className={`flex items-center gap-2 py-4 font-display text-base font-semibold ${
            railOpen ? "px-4" : "flex-col px-2"
          }`}
        >
          <Compass className="size-5 shrink-0 text-sidebar-primary" />
          {railOpen && <span className="truncate">Course Compass</span>}
          <button
            onClick={() => setRailOpen((open) => !open)}
            aria-label={railOpen ? "Collapse chat tabs" : "Expand chat tabs"}
            className={`rounded-lg p-1.5 opacity-70 transition-colors hover:bg-sidebar-accent hover:opacity-100 ${
              railOpen ? "ml-auto" : "mt-1"
            }`}
          >
            {railOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </button>
        </div>

        <button
          onClick={() => navigate({ to: "/courses" })}
          aria-label="All courses"
          title="All courses"
          className={`mb-3 inline-flex items-center gap-2 rounded-lg py-2 text-sm font-medium opacity-80 transition-colors hover:bg-sidebar-accent hover:opacity-100 ${
            railOpen ? "mx-3 px-3" : "mx-2 justify-center px-0"
          }`}
        >
          <ArrowLeft className="size-4 shrink-0" />
          {railOpen && "All courses"}
        </button>

        {railOpen && (
          <div className="px-4 pb-3">
            <p className="text-[0.62rem] tracking-[0.16em] uppercase opacity-60">Class chat</p>
            <p className="mt-1 text-xs opacity-60">
              Pick a tab to read it in the main view — badges show what is unread and unresolved.
            </p>
          </div>
        )}

        <ChatTabList
          messages={messages}
          tab={chatTab}
          onChange={(next) => {
            setChatTab(next);
            if (window.innerWidth < 640) setRailOpen(false);
          }}
          threadCount={threadStats.filter((item) => item.health !== "settled").length}
          sessionKey={session?.id ?? activeCourse?.id ?? "none"}

          collapsed={!railOpen}
        />
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
            {session && (
              <SafetyMenu
                paused={session.chat_paused}
                students={online}
                blocks={blocks}
                busy={safetyMutation.isPending}
                onPause={(paused) => safetyMutation.mutate({ type: "pause", paused })}
                onMute={(label, minutes) =>
                  safetyMutation.mutate({ type: "mute", label, minutes })
                }
                onRemove={(label) => safetyMutation.mutate({ type: "remove", label })}
                onLift={(label) => safetyMutation.mutate({ type: "lift", label })}
              />
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
            {session.chat_paused && (
              <div className="flex items-center gap-2 border-b border-border bg-warning/12 px-4 py-3 text-sm font-medium text-warning sm:px-6">
                <Pause className="size-4" />
                Chat is paused — students cannot send messages right now.
              </div>
            )}
            {audioAlert && (
              <div className="flex items-center gap-2 border-b border-border bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive sm:px-6">
                <Volume2 className="size-4" />
                Most students say they cannot hear you — check your microphone.
              </div>
            )}
            {chatTab === "topics" ? (
              <ThreadBoard
                stats={threadStats}
                messages={messages}
                isLoading={threadsLoading || messagesLoading}
              />
            ) : (
              <RawChatList messages={messages} tab={chatTab} />
            )}
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

      <aside className="hidden w-72 shrink-0 space-y-4 border-border p-4 md:block md:h-screen md:overflow-y-auto md:border-l lg:w-80">
        <TopThread item={topThread} />
        <StudentsOnline names={online} />
        <StudentApprovals
          enrollments={enrollments}
          pendingId={decidingId}
          onDecide={(id, status) => decideMutation.mutate({ id, status })}
        />
        {session && <ClassPulse reactions={reactions} />}
        <ClassroomSettingsPanel
          settings={settings}
          saving={settingsMutation.isPending}
          level={settingsLevel}
          canChooseLevel={Boolean(isStaff && profile?.organization_id)}
          onLevelChange={setSettingsLevel}
          onChange={(patch) => settingsMutation.mutate(patch)}
          devMode={devMode}
          studentsOnline={online.length}
          onDevMode={(on) => {
            setDev(on);
            setDevMode(on);
          }}
        />
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
