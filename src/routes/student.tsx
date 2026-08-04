import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, KeyRound, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { StudentChat } from "@/components/student/StudentChat";
import { DEFAULT_SETTINGS, fetchSettings } from "@/lib/settings";
import {
  fetchCourseByCode,
  fetchCoursesByIds,
  fetchLiveClass,
  fetchMyEnrollments,
  requestEnrollment,
  type StudentCourse,
} from "@/lib/student-chat";

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [
      { title: "Student chat — Course Compass" },
      {
        name: "description",
        content:
          "Enrol with your teacher's course code, then open this tab next to Zoom to send questions during the live class.",
      },
      { property: "og:title", content: "Student chat — Course Compass" },
      {
        property: "og:description",
        content: "Join your live class chat while you watch the lecture in Zoom.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentHome,
});

const joinSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(60),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
});

type Me = { id: string; email: string } | null;

function StudentHome() {
  const [me, setMe] = useState<Me>(null);
  const [ready, setReady] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMe(data.user ? { id: data.user.id, email: data.user.email ?? "" } : null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setMe(session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!me) return <SignedOut />;
  if (courseId) return <CourseRoom me={me} courseId={courseId} onLeave={() => setCourseId(null)} />;
  return <Enrolment me={me} onEnter={setCourseId} />;
}

function SignedOut() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5">
      <div className="panel space-y-4 p-8 text-center">
        <GraduationCap className="mx-auto size-6 text-accent" />
        <h1 className="font-display text-2xl font-semibold">Student sign in</h1>
        <p className="text-sm text-muted-foreground">
          Create a student account once — after that you stay signed in and go straight to your
          courses.
        </p>
        <Link
          to="/auth"
          search={{ role: "student" }}
          className="inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
        >
          Continue
        </Link>
        <Link to="/" className="block text-xs text-muted-foreground hover:text-foreground">
          Back home
        </Link>
      </div>
    </main>
  );
}

/* --------------------------------- enrolment -------------------------------- */

function Enrolment({
  me,
  onEnter,
}: {
  me: { id: string; email: string };
  onEnter: (id: string) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"courses" | "enrol">("courses");
  const [code, setCode] = useState("");
  const [found, setFound] = useState<StudentCourse | null>(null);
  const [form, setForm] = useState({ name: "", email: me.email, phone: "" });
  const [checking, setChecking] = useState(false);

  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments", me.id],
    queryFn: () => fetchMyEnrollments(me.id),
    refetchInterval: 10000,
  });
  const enrollments = enrollmentsQuery.data ?? [];

  const coursesQuery = useQuery({
    queryKey: ["my-courses", enrollments.map((e) => e.course_id).join(",")],
    queryFn: () => fetchCoursesByIds(enrollments.map((e) => e.course_id)),
    enabled: enrollments.length > 0,
  });
  const courses = coursesQuery.data ?? [];

  const joinMutation = useMutation({
    mutationFn: (course: StudentCourse) => {
      const parsed = joinSchema.parse(form);
      return requestEnrollment({
        courseId: course.id,
        teacherId: course.teacher_id,
        studentUserId: me.id,
        studentLabel: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-enrollments", me.id] });
      setFound(null);
      setCode("");
      setTab("courses");
      toast.success("Request sent — your teacher will approve you shortly");
    },
    onError: (error) =>
      toast.error(
        error instanceof z.ZodError ? error.issues[0]!.message : "Could not send the request",
      ),
  });

  async function lookUp(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    try {
      const course = await fetchCourseByCode(code);
      if (!course) {
        toast.error("No active course with that code");
        setFound(null);
        return;
      }
      if (enrollments.some((item) => item.course_id === course.id)) {
        toast.info("You already requested this course");
        setTab("courses");
        return;
      }
      setFound(course);
    } catch {
      toast.error("Could not check that code");
    } finally {
      setChecking(false);
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
            Student
          </p>
          <h1 className="truncate font-display text-2xl font-semibold">My classes</h1>
        </div>
        <button
          onClick={signOut}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>

      <div className="mt-6 flex gap-1 rounded-lg bg-secondary p-1">
        {(["courses", "enrol"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "courses" ? "My courses" : "Enrol with a code"}
          </button>
        ))}
      </div>

      {tab === "courses" ? (
        <div className="panel mt-4 p-6">
          {enrollments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You are not enrolled yet. Ask your teacher for the course code and use the Enrol tab.
            </p>
          ) : (
            <ul className="space-y-2">
              {enrollments.map((enrollment) => {
                const course = courses.find((item) => item.id === enrollment.course_id);
                return (
                  <li
                    key={enrollment.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {course?.title ?? "Course"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {course?.term ?? "Waiting for details"}
                      </span>
                    </span>
                    {enrollment.status === "approved" ? (
                      <button
                        onClick={() => onEnter(enrollment.course_id)}
                        className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                      >
                        Enter class
                      </button>
                    ) : enrollment.status === "declined" ? (
                      <span className="shrink-0 text-xs text-destructive">Declined</span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Awaiting approval
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="panel mt-4 space-y-5 p-6">
          <form onSubmit={lookUp}>
            <label htmlFor="code" className="text-sm font-medium">
              Course code
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Your teacher shares a 6-character code for their course.
            </p>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                id="code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={6}
                placeholder="e.g. 7HKQ2M"
                className="h-10 min-w-0 rounded-md border border-border bg-background px-3 font-display text-sm tracking-[0.2em] uppercase outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={code.trim().length < 4 || checking}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {checking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Find
              </button>
            </div>
          </form>

          {found && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                joinMutation.mutate(found);
              }}
              className="space-y-3 rounded-lg bg-secondary p-4"
            >
              <p className="text-sm">
                Requesting access to <strong>{found.title}</strong>
              </p>
              <Field
                label="Full name"
                value={form.name}
                onChange={(value) => setForm({ ...form, name: value })}
                placeholder="Ayesha Khan"
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) => setForm({ ...form, email: value })}
                placeholder="you@school.edu"
              />
              <Field
                label="Phone number"
                type="tel"
                value={form.phone}
                onChange={(value) => setForm({ ...form, phone: value })}
                placeholder="+92 300 1234567"
              />
              <button
                type="submit"
                disabled={joinMutation.isPending}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                Send request
              </button>
            </form>
          )}
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

/* -------------------------------- live class -------------------------------- */

function CourseRoom({
  me,
  courseId,
  onLeave,
}: {
  me: { id: string; email: string };
  courseId: string;
  onLeave: () => void;
}) {
  const queryClient = useQueryClient();

  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments", me.id],
    queryFn: () => fetchMyEnrollments(me.id),
  });
  const myName =
    enrollmentsQuery.data?.find((item) => item.course_id === courseId)?.student_label ??
    me.email.split("@")[0]!;

  const liveQuery = useQuery({
    queryKey: ["live-class", courseId],
    queryFn: () => fetchLiveClass(courseId),
    refetchInterval: 8000,
  });
  const liveClass = liveQuery.data ?? null;

  // Students obey the same thresholds their teacher configured.
  const settingsQuery = useQuery({
    queryKey: ["classroom-settings", liveClass?.teacher_id],
    queryFn: () => fetchSettings({ organizationId: null, teacherId: liveClass!.teacher_id }),
    enabled: Boolean(liveClass?.teacher_id),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`session-${courseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `course_id=eq.${courseId}` },
        () => queryClient.invalidateQueries({ queryKey: ["live-class", courseId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [courseId, queryClient]);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
            Signed in as {myName}
          </p>
          <h1 className="truncate font-display text-2xl font-semibold">Class chat</h1>
        </div>
        <button
          onClick={onLeave}
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          My courses
        </button>
      </div>

      {liveClass ? (
        <StudentChat
          liveClass={liveClass}
          studentName={myName}
          settings={settingsQuery.data ?? DEFAULT_SETTINGS}
        />
      ) : (
        <div className="panel flex flex-col items-center gap-2 px-6 py-16 text-center">
          <GraduationCap className="size-6 text-muted-foreground" />
          <p className="font-display text-lg font-semibold">No class is currently live.</p>
          <p className="text-sm text-muted-foreground">
            Keep this tab open — you join automatically when your teacher starts the session.
          </p>
        </div>
      )}
    </main>
  );
}
