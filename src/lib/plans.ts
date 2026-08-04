export type PlanId = "teacher-pro" | "academy" | "enterprise";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  audience: string;
  price: string;
  cta: string;
  features: string[];
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "teacher-pro",
    name: "Teacher Plan",
    tagline: "For independent tutors",
    audience: "1 teacher · 1 class · up to 200 students · 5,000 AI messages/mo",
    price: "$20/mo",
    cta: "Get Started",
    features: [
      "Live merged discussions",
      "Roman Urdu + English merging",
      "Health checks and polls",
      "Extra class $5/mo · extra 10 students $5/mo",
    ],
    featured: true,
  },
  {
    id: "academy",
    name: "Academy Plan",
    tagline: "For coaching centres and academies",
    audience: "5 teachers · 10 classes · 1,000 students · 15,000 AI messages/mo",
    price: "$100/mo",
    cta: "Book Demo",
    features: [
      "Organization workspace",
      "Teacher approval workflow",
      "Shared classroom settings",
      "Extra teacher $10/mo (+30 students) · extra class $5/mo",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For schools, universities and large organizations",
    audience: "1000+ students per session",
    price: "Custom",
    cta: "Contact Us",
    features: [
      "Stress-tested for very large cohorts",
      "Unlimited teachers, classes and AI messages",
      "Security and access review",
      "Priority support",
    ],
  },
];

export const PLAN_IDS = PLANS.map((plan) => plan.id) as PlanId[];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "demo_scheduled",
  "pilot_running",
  "customer",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  demo_scheduled: "Demo Scheduled",
  pilot_running: "Pilot Running",
  customer: "Customer",
};

export const planName = (id: string) => PLANS.find((p) => p.id === id)?.name ?? id;
