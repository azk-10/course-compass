import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { pageMeta } from "@/lib/seo";
import { PLANS } from "@/lib/plans";

export const Route = createFileRoute("/pricing")({
  head: () =>
    pageMeta({
      title: "Pricing",
      description:
        "Plans for independent tutors, coaching academies and universities. Try the demo free, or talk to us about a pilot for your organization.",
      path: "/pricing",
      ogDescription:
        "Free demo, Teacher Pro, Academy and Enterprise plans. Talk to us about a pilot — no card required.",
    }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="paper-ink flex min-h-screen flex-col">
      <SiteNav />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pt-14 pb-20">
        <section className="max-w-2xl">
          <p className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Pricing
          </p>
          <h1 className="mt-4 text-4xl font-extrabold text-balance sm:text-5xl">
            Pilot pricing, set with you
          </h1>
          <p className="mt-4 text-lg/8 text-muted-foreground">
            Course Compass is in its pilot stage, so we onboard every school, academy and tutor
            personally. Start with the demo, then tell us about your classes and we will put
            together the right plan.
          </p>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`flex flex-col rounded-xl border bg-card p-6 transition-transform hover:-translate-y-1 ${
                plan.featured ? "border-foreground/40 shadow-lg" : "border-border"
              }`}
            >
              {plan.featured ? (
                <span className="mb-3 inline-flex w-fit rounded-full bg-primary px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-primary-foreground uppercase">
                  Most popular
                </span>
              ) : null}
              <h2 className="text-lg font-bold">{plan.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="font-paper-display mt-5 text-2xl font-bold">{plan.price}</p>
              <p className="mt-1 text-xs text-muted-foreground">{plan.audience}</p>
              {plan.id === "enterprise" ? (
                <p className="mt-3 rounded-md bg-secondary/60 p-2.5 text-xs/5 text-muted-foreground">
                  Looking for a pilot? We&apos;re currently partnering with selected schools and
                  academies to test Course Compass in live classrooms.
                </p>
              ) : null}

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm/6">
                    <Check className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.id === "free" ? (
                <Link
                  to="/demo"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-md border border-foreground/20 px-4 py-2.5 text-sm font-bold transition-colors hover:bg-secondary active:scale-[0.97]"
                >
                  {plan.cta} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : (
                <Link
                  to="/contact"
                  search={{ plan: plan.id }}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  {plan.cta} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </article>
          ))}
        </section>

        <section className="paper-rule mt-16 grid gap-6 pt-10 sm:grid-cols-3">
          {[
            {
              q: "Do I pay online?",
              a: "No. During the pilot stage every plan is arranged directly with our team — nothing is charged through the website.",
            },
            {
              q: "How long does onboarding take?",
              a: "Most academies are running their first live session within a few days of the demo call.",
            },
            {
              q: "How large can a class be?",
              a: "Sessions are tested with up to 1000 concurrent students, and the demo lets you stress test it yourself.",
            },
          ].map((item) => (
            <div key={item.q}>
              <h2 className="text-sm font-bold">{item.q}</h2>
              <p className="mt-2 text-sm/6 text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
