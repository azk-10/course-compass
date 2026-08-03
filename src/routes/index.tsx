import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BarChart3, GraduationCap, Layers, Radio } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lecture Pulse — Live teacher dashboard" },
      {
        name: "description",
        content:
          "Lecture Pulse gives teachers a course sidebar, grouped question banks, one-tap live sessions and real-time answer statistics.",
      },
      { property: "og:title", content: "Lecture Pulse — Live teacher dashboard" },
      {
        property: "og:description",
        content:
          "Course sidebar, grouped questions, one-tap live sessions and real-time answer statistics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Layers,
    title: "Grouped question banks",
    body: "Organise prompts into warm-ups, core concepts and exit tickets per course.",
  },
  {
    icon: Radio,
    title: "One-tap live sessions",
    body: "Start a session from the dashboard header and the room is open instantly.",
  },
  {
    icon: BarChart3,
    title: "Real-time statistics",
    body: "Participation, accuracy and per-question breakdowns update as answers land.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-display text-lg font-semibold">
          <GraduationCap className="size-5 text-accent" />
          Lecture Pulse
        </span>
        <Link
          to="/auth"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Teacher sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="py-16">
          <p className="font-display text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Classroom response, without the clutter
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] font-semibold sm:text-6xl">
            The teacher dashboard that keeps up with the room.
          </h1>
          <p className="mt-6 max-w-xl text-base/7 text-muted-foreground">
            Pick a course from the sidebar, hit Start Session, and watch grouped questions turn
            into live participation and accuracy numbers as your class answers.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-lift)] transition-transform hover:-translate-y-0.5"
          >
            Open your dashboard <ArrowRight className="size-4" />
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="panel p-6">
              <f.icon className="size-5 text-accent" />
              <h2 className="mt-4 font-display text-base font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm/6 text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
