import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, RefreshCw } from "lucide-react";

import { StudentChat } from "@/components/student/StudentChat";
import { fetchLiveClasses, type LiveClass } from "@/lib/student-chat";

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
  const [name, setName] = useState("");
  const [joined, setJoined] = useState<{ liveClass: LiveClass; name: string } | null>(null);

  const classesQuery = useQuery({
    queryKey: ["live-classes"],
    queryFn: fetchLiveClasses,
    refetchInterval: 15000,
  });
  const classes = classesQuery.data ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
            Student
          </p>
          <h1 className="font-display text-2xl font-semibold">Live class chat</h1>
        </div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Home
        </Link>
      </div>

      {joined ? (
        <>
          <StudentChat liveClass={joined.liveClass} studentName={joined.name} />
          <button
            onClick={() => setJoined(null)}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground"
          >
            Leave class
          </button>
        </>
      ) : (
        <div className="panel space-y-5 p-6">
          <div>
            <label htmlFor="student-name" className="text-sm font-medium">
              Your name
            </label>
            <input
              id="student-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              placeholder="e.g. Ada"
              className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Live classes</p>
              <button
                onClick={() => classesQuery.refetch()}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </button>
            </div>

            {classesQuery.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Looking for live classes…</p>
            ) : classes.length === 0 ? (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-lg bg-secondary px-4 py-8 text-center">
                <GraduationCap className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No class is live right now. This list refreshes automatically.
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {classes.map((liveClass) => (
                  <li key={liveClass.id}>
                    <button
                      disabled={!name.trim()}
                      onClick={() => setJoined({ liveClass, name: name.trim() })}
                      className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition-colors hover:border-accent disabled:opacity-50"
                    >
                      <span className="text-sm font-medium">{liveClass.title}</span>
                      <span className="inline-flex items-center gap-2 text-xs text-success">
                        <span className="live-dot" /> Live
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!name.trim() && classes.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Enter your name to join.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
