import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Zap } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { StudentChat } from "@/components/student/StudentChat";
import {
  fetchActiveCourses,
  fetchLiveClass,
  fetchMyEnrollments,
  requestEnrollment,
} from "@/lib/student-chat";

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [
      { title: "Student chat — Course Compass" },
      {
        name: "description",
        content:
          "Open this tab next to Zoom, join your course and send questions to your teacher in real time.",
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
  component: StudentDashboard,
});

function StudentDashboard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [confirmedName, setConfirmedName] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (email) setName((current) => current || email.split("@")[0]!);
    });
  }, []);

  const coursesQuery = useQuery({ queryKey: ["student-courses"], queryFn: fetchActiveCourses });
  const courses = coursesQuery.data ?? [];

  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments", confirmedName],
    queryFn: () => fetchMyEnrollments(confirmedName),
    enabled: !!confirmedName,
    refetchInterval: 10000,
  });
  const enrollments = enrollmentsQuery.data ?? [];

  const liveQuery = useQuery({
    queryKey: ["live-class", courseId],
    queryFn: () => fetchLiveClass(courseId!),
    enabled: !!courseId,
    refetchInterval: 8000,
  });
  const liveClass = liveQuery.data ?? null;

  const requestMutation = useMutation({
    mutationFn: (course: { id: string; teacher_id: string }) =>
      requestEnrollment({
        courseId: course.id,
        teacherId: course.teacher_id,
        studentLabel: confirmedName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-enrollments", confirmedName] });
      toast.success("Request sent — waiting for your teacher");
    },
    onError: () => toast.error("Could not send the request"),
  });

  const selectedCourse = courses.find((course) => course.id === courseId) ?? null;

  if (confirmedName && selectedCourse) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <Header />
        {liveClass ? (
          <StudentChat liveClass={liveClass} studentName={confirmedName} />
        ) : (
          <div className="panel flex flex-col items-center gap-2 px-6 py-16 text-center">
            <GraduationCap className="size-6 text-muted-foreground" />
            <p className="font-display text-lg font-semibold">No class is currently live.</p>
            <p className="text-sm text-muted-foreground">
              Keep this tab open — you will join {selectedCourse.title} automatically when your
              teacher starts the session.
            </p>
          </div>
        )}
        <button
          onClick={() => setCourseId(null)}
          className="mt-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Change course
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Header />

      <div className="panel space-y-6 p-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setConfirmedName(name.trim());
          }}
        >
          <label htmlFor="student-name" className="text-sm font-medium">
            Your name
          </label>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              id="student-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              placeholder="e.g. Ada"
              className="h-10 min-w-0 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </form>

        {!confirmedName ? (
          <p className="text-sm text-muted-foreground">
            Enter your name to join a course. Keep watching the lecture in Zoom — this tab is only
            for chat.
          </p>
        ) : coursesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading courses…</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses are open right now.</p>
        ) : (
          <ul className="space-y-2">
            {courses.map((course) => {
              const enrollment = enrollments.find((item) => item.course_id === course.id);
              return (
                <li
                  key={course.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {course.is_crash && <Zap className="size-3.5 shrink-0 text-accent" />}
                      {course.title}
                    </span>
                    {course.term && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {course.term}
                      </span>
                    )}
                  </span>

                  {!enrollment ? (
                    <button
                      onClick={() =>
                        requestMutation.mutate({ id: course.id, teacher_id: course.teacher_id })
                      }
                      disabled={requestMutation.isPending}
                      className="shrink-0 rounded-md border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                      Request access
                    </button>
                  ) : enrollment.status === "pending" ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Awaiting approval
                    </span>
                  ) : enrollment.status === "declined" ? (
                    <span className="shrink-0 text-xs text-destructive">Declined</span>
                  ) : (
                    <button
                      onClick={() => setCourseId(course.id)}
                      className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                    >
                      Enter course
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function Header() {
  return (
    <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        <p className="text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">Student</p>
        <h1 className="truncate font-display text-2xl font-semibold">Class chat</h1>
      </div>
      <Link to="/" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">
        Home
      </Link>
    </div>
  );
}
