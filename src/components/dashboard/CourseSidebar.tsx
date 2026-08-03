import { GraduationCap, LogOut, Plus, BookOpen } from "lucide-react";
import type { Course } from "@/lib/dashboard-data";

export function CourseSidebar({
  courses,
  activeId,
  onSelect,
  onAddCourse,
  onSignOut,
  email,
}: {
  courses: Course[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddCourse: () => void;
  onSignOut: () => void;
  email: string;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:h-screen lg:w-72 lg:sticky lg:top-0">
      <div className="flex items-center gap-2 px-5 py-6 font-display text-base font-semibold">
        <GraduationCap className="size-5 text-sidebar-primary" />
        Lecture Pulse
      </div>

      <div className="flex items-center justify-between px-5 pb-2">
        <span className="text-[0.7rem] font-medium tracking-[0.16em] uppercase opacity-60">
          Courses
        </span>
        <button
          onClick={onAddCourse}
          aria-label="Add course"
          className="rounded-md p-1 opacity-70 transition-colors hover:bg-sidebar-accent hover:opacity-100"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {courses.length === 0 && (
          <p className="px-2 py-3 text-sm opacity-60">No courses yet.</p>
        )}
        {courses.map((course) => {
          const active = course.id === activeId;
          return (
            <button
              key={course.id}
              onClick={() => onSelect(course.id)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/60"
              }`}
            >
              <BookOpen
                className={`mt-0.5 size-4 shrink-0 ${active ? "text-sidebar-primary" : "opacity-60"}`}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{course.title}</span>
                {course.term && (
                  <span className="block truncate text-xs opacity-60">{course.term}</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="truncate text-xs opacity-70">{email}</p>
        <button
          onClick={onSignOut}
          className="mt-2 flex items-center gap-2 text-xs font-medium opacity-80 transition-opacity hover:opacity-100"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
