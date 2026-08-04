import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Gauge,
  Languages,
  Layers,
  ListOrdered,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Course Compass" },
      {
        name: "description",
        content:
          "Auto-merge, message classification, thread prioritisation, classroom health checks and live polls — everything Course Compass does with a 1000-student chat.",
      },
      { property: "og:title", content: "Features — Course Compass" },
      {
        property: "og:description",
        content:
          "Merged discussions, Roman Urdu understanding, health checks and polls for very large live classes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/features" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/features" }],
  }),
  component: FeaturesPage,
});

const features = [
  {
    icon: Layers,
    title: "Instant auto-merge",
    body: "Duplicate questions collapse into one thread the moment they are sent — under half a second, with no confirmation step.",
  },
  {
    icon: Languages,
    title: "English and Roman Urdu",
    body: "The same intent written in either language lands in the same discussion, typos and rephrasings included.",
  },
  {
    icon: ListOrdered,
    title: "Priority ranking",
    body: "Upvotes, thread age and unresolved confusion push the most urgent discussion to the top of your view.",
  },
  {
    icon: Sparkles,
    title: "Message classification",
    body: "Every message is filed as a question, answer, technical issue, general chat or spam before it reaches you.",
  },
  {
    icon: Radio,
    title: "Classroom health checks",
    body: "When audio complaints spike, the room is polled automatically so you know instantly whether it is you or them.",
  },
  {
    icon: Users,
    title: "Popularity confirmation",
    body: "When a thread reaches your popularity threshold, the rest of the class is asked whether they have the same question.",
  },
  {
    icon: Gauge,
    title: "Built for 1000+ students",
    body: "An adaptive live transport keeps the feed smooth whether ten or a thousand students are typing.",
  },
  {
    icon: ShieldCheck,
    title: "Spam and off-topic filed away",
    body: "Small talk never reaches your main view, but every raw message stays available in the transcript sidebar.",
  },
];

function FeaturesPage() {
  return (
    <div className="paper-ink flex min-h-screen flex-col">
      <SiteNav />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pt-14 pb-20">
        <section className="max-w-2xl">
          <p className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Features
          </p>
          <h1 className="mt-4 text-4xl font-extrabold text-balance sm:text-5xl">
            Everything that turns a chat flood into a short list
          </h1>
          <p className="mt-4 text-lg/8 text-muted-foreground">
            Course Compass sits beside your Zoom call. Students keep chatting the way they always
            have; you get merged, ranked, classified discussions instead of hundreds of lines.
          </p>
        </section>

        <section className="mt-12 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="border-t border-border p-6 transition-colors hover:bg-secondary/60"
            >
              <feature.icon className="size-5" aria-hidden="true" />
              <h2 className="mt-4 text-base font-bold">{feature.title}</h2>
              <p className="mt-2 text-sm/6 text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="paper-rule mt-16 flex flex-wrap items-center justify-between gap-6 pt-10">
          <div>
            <h2 className="text-2xl font-bold">Watch it handle a question storm</h2>
            <p className="mt-2 max-w-xl text-sm/6 text-muted-foreground">
              The interactive demo simulates a real class, up to 1000 students, with no sign-up.
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
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
