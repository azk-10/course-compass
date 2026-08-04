import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Compass, Layers, Languages, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Course Compass — AI chat for 1000-student Zoom classes" },
      {
        name: "description",
        content:
          "Course Compass replaces Zoom chat for classes of 100–1000+ students. Hundreds of messages merge into a handful of ranked discussions you can actually answer.",
      },
      { property: "og:title", content: "Course Compass — AI chat for 1000-student Zoom classes" },
      {
        property: "og:description",
        content:
          "Hundreds of student messages merge into a handful of ranked discussions. Keep Zoom for video, run the conversation here.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const proofPoints = [
  { value: "1000+", label: "students per session" },
  { value: "<0.5s", label: "merge decision" },
  { value: "5–8", label: "threads instead of 400 messages" },
];

const capabilities = [
  {
    icon: Layers,
    title: "Auto-merge",
    body: "Repeat questions collapse into one thread the moment they are sent.",
  },
  {
    icon: Languages,
    title: "Roman Urdu + English",
    body: "Same intent in either language lands in the same discussion.",
  },
  {
    icon: Sparkles,
    title: "Ranked by pressure",
    body: "Upvotes, age and confusion push the urgent thread to the top.",
  },
  {
    icon: ShieldCheck,
    title: "Spam stays out",
    body: "Off-topic and small talk are filed away, never in your main view.",
  },
];

const rawChat = [
  "sir audio cut ho gaya",
  "can you repeat the last slide?",
  "AUDIO?????",
  "ye formula samajh nahi aaya",
  "hello everyone 👋",
  "which formula sir",
  "mic is breaking",
  "same question here",
  "can u repeat",
];

const mergedThreads = [
  { title: "Audio is breaking up", count: 143, tone: "urgent" as const },
  { title: "Repeat the last slide", count: 61, tone: "attention" as const },
  { title: "Formula on slide 12 unclear", count: 38, tone: "new" as const },
];

const toneClass = {
  urgent: "bg-destructive",
  attention: "bg-warning",
  new: "bg-info",
};

function Landing() {
  return (
    <div className="paper-ink min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6">
        <span className="font-paper-display flex min-w-0 items-center gap-2 text-lg font-bold">
          <img
            src={courseCompassLogo}
            alt="Course Compass logo"
            width={28}
            height={28}
            className="size-7 shrink-0"
          />
          <span className="truncate">Course Compass</span>
        </span>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            to="/demo"
            className="rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Live demo
          </Link>
          <Link
            to="/student"
            className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
          >
            Join as student
          </Link>
          <Link
            to="/auth"
            search={{ role: "owner" as const }}
            className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:inline-flex"
          >
            Organizations
          </Link>
          <Link
            to="/auth"
            search={{ role: "teacher" as const }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
          >
            Teacher sign in
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24">
        <section className="grid items-center gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[0.7rem] font-semibold tracking-[0.18em] uppercase">
              <span className="live-dot size-1.5 rounded-full" />
              A Zoom chat companion
            </p>
            <h1 className="mt-6 text-5xl leading-[0.95] font-extrabold text-balance sm:text-6xl xl:text-7xl">
              400 messages.
              <br />
              <span className="text-muted-foreground">Six real questions.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg/8 text-muted-foreground">
              Course Compass reads every message in your live class, merges the duplicates across
              English and Roman Urdu, and hands you a short ranked list of what the room is actually
              stuck on.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
              >
                Try the live demo <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/auth"
                search={{ role: "teacher" as const }}
                className="inline-flex items-center gap-2 rounded-md border border-foreground/20 px-6 py-3.5 text-sm font-bold transition-colors hover:bg-secondary active:scale-[0.97]"
              >
                Open your dashboard
              </Link>
            </div>
            <dl className="paper-rule mt-12 grid max-w-xl grid-cols-3 gap-6 pt-6">
              {proofPoints.map((point) => (
                <div key={point.label}>
                  <dt className="font-paper-display text-2xl font-bold">{point.value}</dt>
                  <dd className="mt-1 text-xs/5 text-muted-foreground">{point.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-[0_30px_80px_-40px_oklch(0.15_0_0/0.45)] sm:grid-cols-2">
              <div className="rounded-lg bg-secondary/60 p-4">
                <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Zoom chat
                </p>
                <ul className="mt-3 space-y-2">
                  {rawChat.map((line, index) => (
                    <li
                      key={`${line}-${index}`}
                      className="truncate text-xs/5 text-muted-foreground"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
                  Course Compass
                </p>
                <ul className="mt-3 space-y-3">
                  {mergedThreads.map((thread) => (
                    <li key={thread.title} className="rounded-md border border-border p-3">
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${toneClass[thread.tone]}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm leading-snug font-semibold">{thread.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {thread.count} students merged
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">+ 2 resolved automatically</p>
              </div>
            </div>
          </div>
        </section>

        <section className="paper-rule grid gap-px overflow-hidden pt-px sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((capability) => (
            <article
              key={capability.title}
              className="border-t border-border p-6 transition-colors hover:bg-secondary/60"
            >
              <capability.icon className="size-5" />
              <h2 className="mt-4 text-base font-bold">{capability.title}</h2>
              <p className="mt-2 text-sm/6 text-muted-foreground">{capability.body}</p>
            </article>
          ))}
        </section>

        <section className="paper-rule mt-20 flex flex-wrap items-center justify-between gap-6 pt-10">
          <div>
            <h2 className="text-2xl font-bold">See it with 1000 simulated students</h2>
            <p className="mt-2 max-w-xl text-sm/6 text-muted-foreground">
              No sign-up. Launch the simulation, throw a question storm at it, and watch the feed
              collapse into a handful of threads.
            </p>
          </div>
          <Link
            to="/demo"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
          >
            Launch demo <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
