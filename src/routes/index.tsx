import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Compass, MessagesSquare, Pin, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Course Compass — A calm chat companion for Zoom classes" },
      {
        name: "description",
        content:
          "Course Compass replaces Zoom chat for classes of 100–1000+ students: one live session, a fast message feed and a highlighted current discussion.",
      },
      { property: "og:title", content: "Course Compass — A calm chat companion for Zoom classes" },
      {
        property: "og:description",
        content:
          "Replace Zoom chat for very large online classes. Keep Zoom for video, run the conversation here.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: MessagesSquare,
    title: "Chat that feels like Zoom",
    body: "Students just type. No search, no forms, no learning curve — every message is stored raw.",
  },
  {
    icon: Pin,
    title: "Currently discussing",
    body: "Click a message and the whole class instantly sees what you are answering right now.",
  },
  {
    icon: Zap,
    title: "Question & Quiz modes",
    body: "Switch one button to collect answers: multiple choice, numbers, short text or formulas.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-6">
        <span className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
          <Compass className="size-5 shrink-0 text-accent" />
          <span className="truncate">Course Compass</span>
        </span>
        <div className="flex shrink-0 items-center gap-4">
          <Link to="/student" className="text-sm text-muted-foreground hover:text-foreground">
            Join as student
          </Link>
          <Link
            to="/auth"
            search={{ role: "teacher" as const }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Teacher sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="py-16">
          <p className="font-display text-xs tracking-[0.2em] text-muted-foreground uppercase">
            A Zoom chat companion
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] font-semibold sm:text-6xl">
            Keep Zoom for video. Run the conversation here.
          </h1>
          <p className="mt-6 max-w-xl text-base/7 text-muted-foreground">
            Built for classes of 100 to 1000+ students. Open the dashboard beside Zoom, start a
            session, and let the feed do the work — almost nothing to click while you teach.
          </p>
          <Link
            to="/auth"
            search={{ role: "teacher" as const }}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-lift)] transition-transform hover:-translate-y-0.5"
          >
            Open your dashboard <ArrowRight className="size-4" />
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="panel p-6">
              <feature.icon className="size-5 text-accent" />
              <h2 className="mt-4 font-display text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm/6 text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
