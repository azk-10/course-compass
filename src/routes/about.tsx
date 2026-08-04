import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    pageMeta({
      title: "About",
      description:
        "Course Compass was built for teachers running live online classes of hundreds of students, where the chat moves faster than anyone can read.",
      path: "/about",
      ogDescription: "Why we built a Zoom chat companion for very large live classes.",
    }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="paper-ink flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-14 pb-20">
        <h1 className="text-4xl font-extrabold text-balance">About Course Compass</h1>
        <div className="mt-6 space-y-5 text-base/8 text-muted-foreground">
          <p>
            Course Compass began with a simple observation: in a live online class of five hundred
            students, the chat is the only way students can speak — and it is the one part of the
            lesson no teacher can keep up with.
          </p>
          <p>
            Instead of asking teachers to read faster, we merge. Every message is read, classified
            and grouped with the messages that mean the same thing, in English or Roman Urdu, so a
            flood of four hundred lines becomes a short ranked list of what the room is actually
            stuck on.
          </p>
          <p>
            We are currently running pilots with schools, universities, coaching academies and
            independent tutors. Onboarding is done personally with our team so that each classroom's
            thresholds, languages and workflow are set up properly before the first live session.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
