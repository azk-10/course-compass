import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";

import { StudentChat } from "@/components/student/StudentChat";
import {
  fetchActiveCourses,
  fetchLiveClasses,
  fetchMyEnrollments,
  requestEnrollment,
  type LiveClass,
} from "@/lib/student-chat";

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [
      { title: "Student dashboard — Lecture Pulse" },
      {
        name: "description",
        content:
          "Join your live class, follow the message feed in real time and send questions to your teacher.",
      },
      { property: "og:title", content: "Student dashboard — Lecture Pulse" },
      {
        property: "og:description",
        content: "Join a live class and chat with your teacher in real time.",
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
  const [joined, setJoined] = useState<{ liveClass: LiveClass; name: string } | null>(null);

  const coursesQuery = useQuery({
    queryKey: ["student-courses"],
    queryFn: fetchActiveCourses,
  });
  const courses = coursesQuery.data ?? [];

  const classesQuery = useQuery({
    queryKey: ["live-classes"],
    queryFn: fetchLiveClasses,
    refetchInterval: 15000,
  });
  const liveClasses = classesQuery.data ?? [];

  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments", confirmedName],
    queryFn: () => fetchMyEnrollments(confirmedName),
    enabled: !!confirmedName,
    refetchInterval: 10000,
  });
  const enrollments = enrollmentsQuery.data ?? [];

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

  if (joined) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <Header />
        <StudentChat liveClass={joined.liveClass} studentName={joined.name} />
        <button
          onClick={() => setJoined(null)}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground"
        >
          Leave class
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
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
          <div className="mt-2 flex gap-2">
            <input
              id="student-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              placeholder="e.g. Ada"
              className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
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
            Enter your name to request access to a course and join live classes.
          </p>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Courses</p>
              <button
                onClick={() => {
                  coursesQuery.refetch();
                  classesQuery.refetch();
                  enrollmentsQuery.refetch();
                }}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </button>
            </div>

            {coursesQuery.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading courses…</p>
            ) : courses.length === 0 ? (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-lg bg-secondary px-4 py-8 text-center">
                <GraduationCap className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No courses are open right now.</p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {courses.map((course) => {
                  const enrollment = enrollments.find((e) => e.course_id === course.id);
                  const liveClass = liveClasses.find((c) => c.course_id === course.id) ?? null;
                  const approved = enrollment?.status === "approved";

                  return (
                    <li
                      key={course.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {course.is_crash && <Zap className="size-3.5 shrink-0 text-accent" />}
                          {course.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {liveClass ? "Live now" : (course.term ?? "Not live")}
                        </span>
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
                      ) : liveClass ? (
                        <button
                          onClick={() => setJoined({ liveClass, name: confirmedName })}
                          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                        >
                          <span className="live-dot" /> Join chat
                        </button>
                      ) : (
                        <span className="shrink-0 text-xs text-success">Approved</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Header() {
  return (
    <div className="mb-8 flex items-center justify-between gap-4">
      <div>
        <p className="text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">Student</p>
        <h1 className="font-display text-2xl font-semibold">Live class chat</h1>
      </div>
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        Home
      </Link>
    </div>
  );
}
