import { Link, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Course Compass" },
      {
        name: "description",
        content:
          "How Course Compass handles classroom messages, teacher accounts and sales enquiries, and what choices you have over your data.",
      },
      { property: "og:title", content: "Privacy Policy — Course Compass" },
      {
        property: "og:description",
        content: "How Course Compass handles classroom messages, accounts and sales enquiries.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/privacy" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

const sections = [
  {
    title: "What we collect",
    body: "Account details for teachers, organization owners and students (name, email, role and organization), the chat messages sent during a live session, and the details you enter in our contact form.",
  },
  {
    title: "How classroom data is used",
    body: "Session messages are used to group, classify and rank discussions inside your own classroom. They are visible to the teacher running that session and to the organization the course belongs to.",
  },
  {
    title: "Sales enquiries",
    body: "Information submitted through the contact form is stored privately and used only to contact you about a demo or pilot. It is not published anywhere in the product and is visible only to our administrators.",
  },
  {
    title: "Access controls",
    body: "Data is stored on managed cloud infrastructure with row-level access rules, so accounts can only read the records they are entitled to. Administrator access to sales enquiries is role-restricted.",
  },
  {
    title: "Retention and deletion",
    body: "Classroom data is retained for as long as the course exists in your workspace. Organization owners can request deletion of their workspace data, and anyone can request removal of a sales enquiry.",
  },
  {
    title: "Your choices",
    body: "You can ask us to correct or delete your information, or withdraw consent to be contacted, at any time through the contact form.",
  },
];

function PrivacyPage() {
  return (
    <div className="paper-ink flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-14 pb-20">
        <h1 className="text-4xl font-extrabold text-balance">Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This page is maintained by the Course Compass team and describes current practice during
          our pilot stage. It is not an independent certification or audit.
        </p>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold">{section.title}</h2>
              <p className="mt-2 text-base/8 text-muted-foreground">{section.body}</p>
            </section>
          ))}
          <section>
            <h2 className="text-lg font-bold">Contact</h2>
            <p className="mt-2 text-base/8 text-muted-foreground">
              Privacy questions and data requests go through our{" "}
              <Link to="/contact" className="font-semibold text-foreground underline-offset-4 hover:underline">
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
