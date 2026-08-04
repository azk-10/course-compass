export type PlanId = "free" | "teacher-pro" | "academy" | "enterprise";

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
    id: "free",
    name: "Free",
    tagline: "Try the demo",
    audience: "Perfect for evaluation",
    price: "Free",
    cta: "Try Demo",
    features: [
      "Full interactive simulation",
      "Up to 1000 simulated students",
      "Limited live features",
      "No card, no sign-up",
    ],
  },
  {
    id: "teacher-pro",
    name: "Teacher Pro",
    tagline: "For independent tutors",
    audience: "One teacher, unlimited classes",
    price: "Contact Sales",
    cta: "Contact Sales",
    features: [
      "Live merged discussions",
      "Roman Urdu + English merging",
      "Health checks and polls",
      "Email support",
    ],
    featured: true,
  },
  {
    id: "academy",
    name: "Academy",
    tagline: "For coaching centres and academies",
    audience: "Teams of teachers, shared courses",
    price: "Book a Demo",
    cta: "Book Demo",
    features: [
      "Organization workspace",
      "Teacher approval workflow",
      "Shared classroom settings",
      "Onboarding session included",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For schools, universities and large organizations",
    audience: "1000+ students per session",
    price: "Contact Us",
    cta: "Contact Us",
    features: [
      "Stress-tested for very large cohorts",
      "Dedicated pilot programme",
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
