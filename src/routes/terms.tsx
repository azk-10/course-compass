import { Link, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Course Compass" },
      {
        name: "description",
        content:
          "The terms that apply to pilot use of Course Compass by schools, academies, universities and independent teachers.",
      },
      { property: "og:title", content: "Terms of Service — Course Compass" },
      {
        property: "og:description",
        content: "Terms that apply to pilot use of Course Compass.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/terms" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

const sections = [
  {
    title: "Pilot use",
    body: "Course Compass is currently offered to pilot customers. Access, plan scope and duration are agreed directly with our team; nothing is purchased or charged through this website.",
  },
  {
    title: "Accounts",
    body: "Organization owners approve the teachers in their workspace, and teachers are responsible for the sessions they run. Keep your credentials confidential and tell us promptly about any unauthorised access.",
  },
  {
    title: "Acceptable use",
    body: "Do not use Course Compass to harass others, to post unlawful content, or to attempt to disrupt or reverse engineer the service. Teachers may remove or mute participants who break their classroom rules.",
  },
  {
    title: "Classroom content",
    body: "You keep ownership of the content you and your students create. You grant us permission to process it solely to operate the grouping, classification and ranking features of the service.",
  },
  {
    title: "Availability",
    body: "During the pilot the service is provided as is, without warranties. We work to keep live sessions stable but cannot guarantee uninterrupted availability.",
  },
  {
    title: "Changes",
    body: "These terms may change as the product leaves the pilot stage. Material changes will be communicated to pilot customers before they take effect.",
  },
];

function TermsPage() {
  return (
    <div className="paper-ink flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-14 pb-20">
        <h1 className="text-4xl font-extrabold text-balance">Terms of Service</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Maintained by the Course Compass team for the current pilot stage.
        </p>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold">{section.title}</h2>
              <p className="mt-2 text-base/8 text-muted-foreground">{section.body}</p>
            </section>
          ))}
          <section>
            <h2 className="text-lg font-bold">Questions</h2>
            <p className="mt-2 text-base/8 text-muted-foreground">
              Reach the team through the{" "}
              <Link
                to="/contact"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                contact form
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
