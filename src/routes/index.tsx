import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Layers, Languages, ShieldCheck, Sparkles } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { pageMeta } from "@/lib/seo";
import { useOwnerAutoRedirect } from "@/lib/use-owner-redirect";

export const Route = createFileRoute("/")({
  head: () =>
    pageMeta({
      title: "AI chat for 1000-student Zoom classes",
      description:
        "Course Compass replaces Zoom chat for classes of 100–1000+ students. Hundreds of messages merge into a handful of ranked discussions you can actually answer.",
      path: "/",
      ogDescription:
        "Hundreds of student messages merge into a handful of ranked discussions. Keep Zoom for video, run the conversation here.",
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
  useOwnerAutoRedirect();
  return (
    <div className="paper-ink flex min-h-screen flex-col">
      <SiteNav />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pb-24">
        <section className="grid items-center gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[0.7rem] font-semibold tracking-[0.18em] uppercase">
              <span className="live-dot size-1.5 rounded-full" />A Zoom chat companion
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

        <section className="paper-rule mt-20 pt-10">
          <h2 className="text-2xl font-bold">Why teachers switch the chat over</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "You answer the room, not the loudest student",
                body: "Merged threads are ranked by how many students are stuck, so the biggest blocker is always at the top.",
              },
              {
                title: "Nothing is lost",
                body: "The raw transcript, including spam and off-topic chatter, stays one click away in the sidebar.",
              },
              {
                title: "The class tells you when it's fixed",
                body: "Students mark threads resolved or still confusing, and discussions archive themselves once the room agrees.",
              },
            ].map((benefit) => (
              <div key={benefit.title}>
                <h3 className="text-base font-bold">{benefit.title}</h3>
                <p className="mt-2 text-sm/6 text-muted-foreground">{benefit.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="paper-rule mt-20 flex flex-wrap items-center justify-between gap-6 pt-10">
          <div>
            <h2 className="text-2xl font-bold">See it with 1000 simulated students</h2>
            <p className="mt-2 max-w-xl text-sm/6 text-muted-foreground">
              No sign-up. Launch the simulation, throw a question storm at it, and watch the feed
              collapse into a handful of threads. When you're ready, we'll set up a pilot with your
              own teachers.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
            >
              Launch demo <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-md border border-foreground/20 px-6 py-3.5 text-sm font-bold transition-colors hover:bg-secondary active:scale-[0.97]"
            >
              See pricing
            </Link>
            <Link
              to="/contact"
              search={{ plan: "academy" as const }}
              className="inline-flex items-center gap-2 rounded-md border border-foreground/20 px-6 py-3.5 text-sm font-bold transition-colors hover:bg-secondary active:scale-[0.97]"
            >
              Contact sales
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
