import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  BookOpen,
  Compass,
  Copy,
  LogOut,
  Plus,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { NewCourseDialog } from "@/components/dashboard/NewCourseDialog";
import {
  createCourse,
  fetchCourses,
  setCourseArchived,
  type Course,
} from "@/lib/dashboard-data";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({
    meta: [
      { title: "Your courses — Course Compass" },
      {
        name: "description",
        content:
          "Create a course, share its join code with your class and open the live chat companion for that course.",
      },
      { property: "og:title", content: "Your courses — Course Compass" },
      {
        property: "og:description",
        content: "Create courses, share join codes and open a live session.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoursesHome,
});

function CoursesHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const courses = coursesQuery.data ?? [];
  const active = courses.filter((course) => course.status !== "archived");
  const archived = courses.filter((course) => course.status === "archived");

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false);
      toast.success(`Course created — join code ${course.join_code}`);
    },
    onError: () => toast.error("Could not create the course"),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => setCourseArchived(id, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course restored");
    },
    onError: () => toast.error("Could not restore the course"),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { role: "teacher" }, replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-6">
        <span className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
          <Compass className="size-5 shrink-0 text-accent" />
          <span className="truncate">Course Compass</span>
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">{email}</span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold">Your courses</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a course to open its live chat companion. Students join with the course code.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
          >
            <Plus className="size-4" /> New course
          </button>
        </div>

        {coursesQuery.isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading your courses…</p>
        ) : active.length === 0 ? (
          <div className="panel mt-8 flex flex-col items-center gap-2 px-6 py-16 text-center">
            <BookOpen className="size-6 text-muted-foreground" />
            <p className="font-display text-lg font-semibold">No courses yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create your first course — you will get a join code to share with your class.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {active.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <section className="mt-10">
            <p className="flex items-center gap-1.5 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
              <Archive className="size-3.5" /> Archived
            </p>
            <ul className="mt-3 space-y-2">
              {archived.map((course) => (
                <li
                  key={course.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <span className="truncate text-sm">{course.title}</span>
                  <button
                    onClick={() => restoreMutation.mutate(course.id)}
                    disabled={restoreMutation.isPending}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-60"
                  >
                    <ArchiveRestore className="size-3.5" /> Restore
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <NewCourseDialog
        open={open}
        pending={createMutation.isPending}
        onClose={() => setOpen(false)}
        onCreate={(input) => createMutation.mutate(input)}
      />
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  const navigate = useNavigate();
  return (
    <li className="panel flex flex-col gap-4 p-5">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
          {course.is_crash ? <Zap className="size-3.5 text-accent" /> : <BookOpen className="size-3.5" />}
          {course.is_crash ? "Crash course" : "Course"}
        </p>
        <h2 className="mt-1 truncate font-display text-lg font-semibold">{course.title}</h2>
        {course.term && <p className="truncate text-xs text-muted-foreground">{course.term}</p>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-secondary px-3 py-2">
        <span className="min-w-0">
          <span className="block text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            Join code
          </span>
          <span className="font-display text-lg font-semibold tracking-[0.2em]">
            {course.join_code}
          </span>
        </span>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(course.join_code);
            toast.success("Join code copied");
          }}
          aria-label="Copy join code"
          className="rounded-md border border-input p-2 transition-colors hover:bg-background"
        >
          <Copy className="size-4" />
        </button>
      </div>

      <button
        onClick={() =>
          navigate({ to: "/courses/$courseId", params: { courseId: course.id } })
        }
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Enter course <ArrowRight className="size-4" />
      </button>
    </li>
  );
}
