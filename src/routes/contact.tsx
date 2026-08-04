import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { submitLead } from "@/lib/leads.functions";
import { PLANS, type PlanId } from "@/lib/plans";

const PLAN_IDS = PLANS.map((p) => p.id);

export const Route = createFileRoute("/contact")({
  validateSearch: (search: Record<string, unknown>) => ({
    plan: (PLAN_IDS.includes(search["plan"] as PlanId)
      ? (search["plan"] as PlanId)
      : "teacher-pro") as PlanId,
  }),
  head: () => ({
    meta: [
      { title: "Request a demo — Course Compass" },
      {
        name: "description",
        content:
          "Tell us about your classes and we will schedule a Course Compass demo and set up a pilot for your school, academy or tutoring practice.",
      },
      { property: "og:title", content: "Request a demo — Course Compass" },
      {
        property: "og:description",
        content: "Book a Course Compass demo for your school, academy or tutoring practice.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/contact" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

type Errors = Partial<Record<string, string>>;

const field =
  "mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10";

function ContactPage() {
  const { plan } = Route.useSearch();
  const send = useServerFn(submitLead);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const get = (key: string) => String(fd.get(key) ?? "").trim();

    const next: Errors = {};
    if (get("name").length < 2) next["name"] = "Please enter your full name.";
    if (get("organization").length < 2) next["organization"] = "Please enter your organization.";
    if (get("role").length < 2) next["role"] = "Please enter your role.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email"))) next["email"] = "Enter a valid email.";
    if (get("phone").length < 5) next["phone"] = "Enter a phone or WhatsApp number.";
    if (get("country").length < 2) next["country"] = "Please enter your country.";
    if (fd.get("consent") !== "on") next["consent"] = "Please agree to be contacted.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const toInt = (key: string) => {
      const raw = get(key);
      if (!raw) return null;
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };

    setBusy(true);
    setFailed(null);
    try {
      await send({
        data: {
          name: get("name"),
          organization: get("organization"),
          role: get("role"),
          email: get("email"),
          phone: get("phone"),
          country: get("country"),
          teachers: toInt("teachers"),
          students: toInt("students"),
          plan: get("plan") || plan,
          message: get("message").slice(0, 2000),
          consent: true,
        },
      });
      setDone(true);
    } catch {
      setFailed("We couldn't send your request just now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="paper-ink flex min-h-screen flex-col">
      <SiteNav />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-14 pb-20">
        {done ? (
          <section
            aria-live="polite"
            className="rounded-xl border border-border bg-card p-10 text-center"
          >
            <CheckCircle2 className="mx-auto size-10" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-extrabold">
              Thank you for your interest in Course Compass.
            </h1>
            <p className="mt-3 text-sm/7 text-muted-foreground">
              Your request has been received. We'll contact you shortly to schedule a demo.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                to="/demo"
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
              >
                Explore the demo
              </Link>
              <Link
                to="/"
                className="rounded-md border border-foreground/20 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-secondary active:scale-[0.97]"
              >
                Back home
              </Link>
            </div>
          </section>
        ) : (
          <>
            <p className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Contact sales
            </p>
            <h1 className="mt-4 text-4xl font-extrabold text-balance">Request a demo</h1>
            <p className="mt-4 text-base/7 text-muted-foreground">
              Tell us about your classes and we'll walk you through Course Compass live, then set up
              a pilot with your own teachers and students.
            </p>

            <form onSubmit={onSubmit} noValidate className="mt-10 grid gap-5 sm:grid-cols-2">
              {[
                { name: "name", label: "Name", type: "text", required: true, autoComplete: "name" },
                {
                  name: "organization",
                  label: "Organization",
                  type: "text",
                  required: true,
                  autoComplete: "organization",
                },
                {
                  name: "role",
                  label: "Role",
                  type: "text",
                  required: true,
                  autoComplete: "organization-title",
                },
                {
                  name: "email",
                  label: "Email",
                  type: "email",
                  required: true,
                  autoComplete: "email",
                },
                {
                  name: "phone",
                  label: "Phone / WhatsApp",
                  type: "tel",
                  required: true,
                  autoComplete: "tel",
                },
                {
                  name: "country",
                  label: "Country",
                  type: "text",
                  required: true,
                  autoComplete: "country-name",
                },
                { name: "teachers", label: "Number of teachers", type: "number", required: false },
                {
                  name: "students",
                  label: "Approximate number of students",
                  type: "number",
                  required: false,
                },
              ].map((input) => (
                <div key={input.name}>
                  <label htmlFor={input.name} className="text-sm font-semibold">
                    {input.label}
                    {input.required ? <span aria-hidden="true"> *</span> : null}
                  </label>
                  <input
                    id={input.name}
                    name={input.name}
                    type={input.type}
                    min={input.type === "number" ? 0 : undefined}
                    autoComplete={"autoComplete" in input ? input.autoComplete : undefined}
                    aria-required={input.required}
                    aria-invalid={Boolean(errors[input.name])}
                    aria-describedby={errors[input.name] ? `${input.name}-error` : undefined}
                    className={field}
                  />
                  {errors[input.name] ? (
                    <p id={`${input.name}-error`} className="mt-1 text-xs text-destructive">
                      {errors[input.name]}
                    </p>
                  ) : null}
                </div>
              ))}

              <div className="sm:col-span-2">
                <label htmlFor="plan" className="text-sm font-semibold">
                  Selected plan
                </label>
                <select id="plan" name="plan" defaultValue={plan} className={field}>
                  {PLANS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="message" className="text-sm font-semibold">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  maxLength={2000}
                  placeholder="How many live classes do you run, and what would you like to see?"
                  className={field}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="consent" className="flex items-start gap-3 text-sm/6">
                  <input
                    id="consent"
                    name="consent"
                    type="checkbox"
                    aria-required="true"
                    aria-invalid={Boolean(errors["consent"])}
                    className="mt-1 size-4 shrink-0 rounded border-border"
                  />
                  <span className="text-muted-foreground">
                    I agree to be contacted by the Course Compass team about this request.
                  </span>
                </label>
                {errors["consent"] ? (
                  <p className="mt-1 text-xs text-destructive">{errors["consent"]}</p>
                ) : null}
              </div>

              {failed ? (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {failed}
                </p>
              ) : null}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {busy ? "Sending…" : "Send request"}
                </button>
              </div>
            </form>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
