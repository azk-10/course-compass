/**
 * Pure pricing engine. All numbers come from the `plans` table so pricing can
 * change without a code deploy. Shared by the owner dashboard, the customer
 * billing panel and the capacity upsell prompts.
 */

export type PlanRow = {
  id: string;
  name: string;
  kind: "teacher" | "academy" | "enterprise";
  base_price_cents: number;
  included_classes: number;
  included_teachers: number;
  included_students: number;
  included_ai_messages: number;
  extra_class_price_cents: number;
  extra_teacher_price_cents: number;
  student_block_size: number;
  extra_student_block_price_cents: number;
  is_custom: boolean;
};

export type SubscriptionRow = {
  id: string;
  owner_user_id: string;
  organization_id: string | null;
  plan_id: string;
  status: "active" | "suspended" | "expired" | "pending";
  classes_allowed: number;
  teachers_allowed: number;
  students_allowed: number;
  ai_messages_allowed: number;
  storage_mb_allowed: number;
  unlimited_classes: boolean;
  unlimited_teachers: boolean;
  unlimited_students: boolean;
  unlimited_ai: boolean;
  unlimited_storage: boolean;
  is_free: boolean;
  custom_base_price_cents: number | null;
  current_period_start: string;
  current_period_end: string;
};

export type InvoiceBreakdown = {
  baseCents: number;
  extraClasses: number;
  extraClassesCents: number;
  extraTeachers: number;
  extraTeachersCents: number;
  extraStudentBlocks: number;
  extraStudentsCents: number;
  totalCents: number;
  includedStudents: number;
};

/** Students an academy gets for free once extra teachers are added. */
const ACADEMY_STUDENTS_PER_TEACHER = 30;

export function includedStudentsFor(plan: PlanRow, teachersAllowed: number): number {
  if (plan.kind !== "academy") return plan.included_students;
  const extraTeachers = Math.max(0, teachersAllowed - plan.included_teachers);
  return plan.included_students + extraTeachers * ACADEMY_STUDENTS_PER_TEACHER;
}

/** Calculates what the next monthly invoice looks like for a subscription. */
export function calculateInvoice(plan: PlanRow, sub: SubscriptionRow): InvoiceBreakdown {
  const empty: InvoiceBreakdown = {
    baseCents: 0,
    extraClasses: 0,
    extraClassesCents: 0,
    extraTeachers: 0,
    extraTeachersCents: 0,
    extraStudentBlocks: 0,
    extraStudentsCents: 0,
    totalCents: 0,
    includedStudents: includedStudentsFor(plan, sub.teachers_allowed),
  };

  if (sub.is_free || plan.is_custom) {
    return { ...empty, baseCents: sub.custom_base_price_cents ?? 0, totalCents: sub.is_free ? 0 : (sub.custom_base_price_cents ?? 0) };
  }

  const baseCents = sub.custom_base_price_cents ?? plan.base_price_cents;

  const extraClasses = sub.unlimited_classes
    ? 0
    : Math.max(0, sub.classes_allowed - plan.included_classes);
  const extraTeachers = sub.unlimited_teachers
    ? 0
    : Math.max(0, sub.teachers_allowed - plan.included_teachers);

  const includedStudents = includedStudentsFor(plan, sub.teachers_allowed);
  const blockSize = Math.max(1, plan.student_block_size);
  const extraStudentBlocks = sub.unlimited_students
    ? 0
    : Math.ceil(Math.max(0, sub.students_allowed - includedStudents) / blockSize);

  const extraClassesCents = extraClasses * plan.extra_class_price_cents;
  const extraTeachersCents = extraTeachers * plan.extra_teacher_price_cents;
  const extraStudentsCents = extraStudentBlocks * plan.extra_student_block_price_cents;

  return {
    baseCents,
    extraClasses,
    extraClassesCents,
    extraTeachers,
    extraTeachersCents,
    extraStudentBlocks,
    extraStudentsCents,
    includedStudents,
    totalCents: baseCents + extraClassesCents + extraTeachersCents + extraStudentsCents,
  };
}

/** Cost of adding capacity, shown before the user confirms the upsell. */
export function upsellCostCents(
  plan: PlanRow,
  kind: "class" | "teacher" | "student_block",
  quantity = 1,
): number {
  const unit =
    kind === "class"
      ? plan.extra_class_price_cents
      : kind === "teacher"
        ? plan.extra_teacher_price_cents
        : plan.extra_student_block_price_cents;
  return unit * quantity;
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function periodLabel(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}
