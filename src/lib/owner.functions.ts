import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OwnerStats = {
  teachers: number;
  academies: number;
  students: number;
  organizations: number;
  activeSubs: number;
  suspendedSubs: number;
  pendingApprovals: number;
  monthlyRevenueCents: number;
  aiMessagesThisMonth: number;
  aiCostEstimateCents: number;
};

export type OwnerAccount = {
  subscriptionId: string | null;
  userId: string;
  email: string | null;
  displayName: string | null;
  role: string;
  accountStatus: string;
  organizationId: string | null;
  organizationName: string | null;
  planId: string | null;
  status: string | null;
  classesAllowed: number;
  teachersAllowed: number;
  studentsAllowed: number;
  aiMessagesAllowed: number;
  unlimitedAi: boolean;
  unlimitedStudents: boolean;
  unlimitedClasses: boolean;
  unlimitedTeachers: boolean;
  isFree: boolean;
  aiMessagesUsed: number;
  classesUsed: number;
  studentsUsed: number;
  createdAt: string;
};

/** Whether the signed-in user is the platform owner. Safe for any user to call. */
export const amIOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_owner", { _user_id: context.userId });
    return data === true;
  });

/** Owner: headline platform metrics. */
export const getOwnerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerStats> => {
    const { assertOwner, currentPeriodMonth } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { calculateInvoice } = await import("@/lib/billing");

    const [profiles, orgs, subs, plans, usage] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, role, approval_status"),
      supabaseAdmin.from("organizations").select("id"),
      supabaseAdmin.from("subscriptions").select("*"),
      supabaseAdmin.from("plans").select("*"),
      supabaseAdmin.from("usage_counters").select("ai_messages").eq("period_month", currentPeriodMonth()),
    ]);

    const planById = new Map((plans.data ?? []).map((p) => [p.id, p]));
    let revenue = 0;
    for (const sub of subs.data ?? []) {
      const plan = planById.get(sub.plan_id);
      if (!plan || sub.status !== "active") continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      revenue += calculateInvoice(plan as any, sub as any).totalCents;
    }
    const aiMessages = (usage.data ?? []).reduce((sum, row) => sum + (row.ai_messages ?? 0), 0);
    const rows = profiles.data ?? [];

    return {
      teachers: rows.filter((r) => r.role === "teacher").length,
      academies: rows.filter((r) => r.role === "owner").length,
      students: rows.filter((r) => r.role === "student").length,
      organizations: (orgs.data ?? []).length,
      activeSubs: (subs.data ?? []).filter((s) => s.status === "active").length,
      suspendedSubs: (subs.data ?? []).filter((s) => s.status !== "active").length,
      pendingApprovals: rows.filter((r) => r.approval_status === "pending").length,
      monthlyRevenueCents: revenue,
      aiMessagesThisMonth: aiMessages,
      // Gemini Flash Lite ≈ $0.0002 per merge request.
      aiCostEstimateCents: Math.round(aiMessages * 0.02),
    };
  });

/** Owner: every teacher / academy account with plan, limits and live usage. */
export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ kind: z.enum(["teacher", "academy", "student"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<OwnerAccount[]> => {
    const { assertOwner, currentPeriodMonth } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const roleFilter =
      data.kind === "academy" ? ["owner", "admin"] : data.kind === "student" ? ["student"] : ["teacher"];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, role, organization_id, account_status, created_at")
      .in("role", roleFilter)
      .order("created_at", { ascending: false })
      .limit(1000);

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return [];

    const [subs, orgs, usage, courses, enrollments] = await Promise.all([
      supabaseAdmin.from("subscriptions").select("*").in("owner_user_id", ids),
      supabaseAdmin.from("organizations").select("id, name"),
      supabaseAdmin.from("usage_counters").select("subscription_id, ai_messages").eq("period_month", currentPeriodMonth()),
      supabaseAdmin.from("courses").select("id, teacher_id"),
      supabaseAdmin.from("enrollments").select("teacher_id, status"),
    ]);

    const subByUser = new Map((subs.data ?? []).map((s) => [s.owner_user_id, s]));
    const orgById = new Map((orgs.data ?? []).map((o) => [o.id, o.name]));
    const usageBySub = new Map((usage.data ?? []).map((u) => [u.subscription_id, u.ai_messages]));

    return (profiles ?? []).map((p) => {
      const sub = subByUser.get(p.id);
      return {
        subscriptionId: sub?.id ?? null,
        userId: p.id,
        email: p.email,
        displayName: p.display_name,
        role: p.role,
        accountStatus: p.account_status ?? "active",
        organizationId: p.organization_id,
        organizationName: p.organization_id ? (orgById.get(p.organization_id) ?? null) : null,
        planId: sub?.plan_id ?? null,
        status: sub?.status ?? null,
        classesAllowed: sub?.classes_allowed ?? 0,
        teachersAllowed: sub?.teachers_allowed ?? 0,
        studentsAllowed: sub?.students_allowed ?? 0,
        aiMessagesAllowed: sub?.ai_messages_allowed ?? 0,
        unlimitedAi: sub?.unlimited_ai ?? false,
        unlimitedStudents: sub?.unlimited_students ?? false,
        unlimitedClasses: sub?.unlimited_classes ?? false,
        unlimitedTeachers: sub?.unlimited_teachers ?? false,
        isFree: sub?.is_free ?? false,
        aiMessagesUsed: sub ? (usageBySub.get(sub.id) ?? 0) : 0,
        classesUsed: (courses.data ?? []).filter((c) => c.teacher_id === p.id).length,
        studentsUsed: (enrollments.data ?? []).filter(
          (e) => e.teacher_id === p.id && e.status === "approved",
        ).length,
        createdAt: p.created_at,
      };
    });
  });

/** Owner: change a subscription's plan, limits, unlimited flags or status. */
export const updateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        planId: z.string().min(1).optional(),
        status: z.enum(["active", "suspended", "expired", "pending"]).optional(),
        classesAllowed: z.number().int().min(0).max(100000).optional(),
        teachersAllowed: z.number().int().min(0).max(100000).optional(),
        studentsAllowed: z.number().int().min(0).max(1000000).optional(),
        aiMessagesAllowed: z.number().int().min(0).max(100000000).optional(),
        storageMbAllowed: z.number().int().min(0).max(10000000).optional(),
        unlimitedAi: z.boolean().optional(),
        unlimitedStudents: z.boolean().optional(),
        unlimitedClasses: z.boolean().optional(),
        unlimitedTeachers: z.boolean().optional(),
        unlimitedStorage: z.boolean().optional(),
        isFree: z.boolean().optional(),
        customBasePriceCents: z.number().int().min(0).max(100000000).nullable().optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {};
    if (data.planId !== undefined) patch["plan_id"] = data.planId;
    if (data.status !== undefined) patch["status"] = data.status;
    if (data.classesAllowed !== undefined) patch["classes_allowed"] = data.classesAllowed;
    if (data.teachersAllowed !== undefined) patch["teachers_allowed"] = data.teachersAllowed;
    if (data.studentsAllowed !== undefined) patch["students_allowed"] = data.studentsAllowed;
    if (data.aiMessagesAllowed !== undefined) patch["ai_messages_allowed"] = data.aiMessagesAllowed;
    if (data.storageMbAllowed !== undefined) patch["storage_mb_allowed"] = data.storageMbAllowed;
    if (data.unlimitedAi !== undefined) patch["unlimited_ai"] = data.unlimitedAi;
    if (data.unlimitedStudents !== undefined) patch["unlimited_students"] = data.unlimitedStudents;
    if (data.unlimitedClasses !== undefined) patch["unlimited_classes"] = data.unlimitedClasses;
    if (data.unlimitedTeachers !== undefined) patch["unlimited_teachers"] = data.unlimitedTeachers;
    if (data.unlimitedStorage !== undefined) patch["unlimited_storage"] = data.unlimitedStorage;
    if (data.isFree !== undefined) patch["is_free"] = data.isFree;
    if (data.customBasePriceCents !== undefined)
      patch["custom_base_price_cents"] = data.customBasePriceCents;
    if (data.notes !== undefined) patch["notes"] = data.notes;

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("owner_user_id", data.userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin.from("subscriptions").update(patch as never).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("subscriptions").insert({
        owner_user_id: data.userId,
        plan_id: data.planId ?? "teacher",
        ...patch,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

/** Owner: suspend, reactivate or ban an account. */
export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["active", "suspended", "banned"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ account_status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    if (data.status !== "active") {
      await supabaseAdmin.auth.admin.signOut(data.userId).catch(() => undefined);
    }
    return { ok: true as const };
  });

/** Owner: force a user to sign out of every device. */
export const forceLogout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.signOut(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Owner: send a password reset link to a user. */
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Owner: permanently delete a user account and everything they own. */
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete the owner account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type OwnerInvoice = {
  id: string;
  subscriptionId: string;
  customer: string | null;
  email: string | null;
  planId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  baseCents: number;
  extraClasses: number;
  extraClassesCents: number;
  extraTeachers: number;
  extraTeachersCents: number;
  extraStudentBlocks: number;
  extraStudentsCents: number;
  discountCents: number;
  totalCents: number;
  createdAt: string;
};

/** Owner: every invoice across the platform. */
export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerInvoice[]> => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .order("period_start", { ascending: false })
      .limit(1000);
    const subIds = [...new Set((invoices ?? []).map((i) => i.subscription_id))];
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("id, owner_user_id, plan_id")
      .in("id", subIds.length ? subIds : ["00000000-0000-0000-0000-000000000000"]);
    const userIds = (subs ?? []).map((s) => s.owner_user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const subById = new Map((subs ?? []).map((s) => [s.id, s]));
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (invoices ?? []).map((inv) => {
      const sub = subById.get(inv.subscription_id);
      const profile = sub ? profileById.get(sub.owner_user_id) : undefined;
      return {
        id: inv.id,
        subscriptionId: inv.subscription_id,
        customer: profile?.display_name ?? null,
        email: profile?.email ?? null,
        planId: sub?.plan_id ?? "—",
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        status: inv.status,
        baseCents: inv.base_cents,
        extraClasses: inv.extra_classes,
        extraClassesCents: inv.extra_classes_cents,
        extraTeachers: inv.extra_teachers,
        extraTeachersCents: inv.extra_teachers_cents,
        extraStudentBlocks: inv.extra_student_blocks,
        extraStudentsCents: inv.extra_students_cents,
        discountCents: inv.discount_cents,
        totalCents: inv.total_cents,
        createdAt: inv.created_at,
      };
    });
  });

/** Owner: mark an invoice paid, waived, overdue, or apply a discount. */
export const updateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "pending", "paid", "failed", "overdue", "waived", "refunded"]).optional(),
        discountCents: z.number().int().min(0).max(100000000).optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invoice, error: readError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readError || !invoice) throw new Error("Invoice not found");

    const discount = data.discountCents ?? invoice.discount_cents;
    const gross =
      invoice.base_cents +
      invoice.extra_classes_cents +
      invoice.extra_teachers_cents +
      invoice.extra_students_cents;

    const { error } = await supabaseAdmin
      .from("invoices")
      .update({
        ...(data.status ? { status: data.status } : {}),
        ...(data.status === "paid" ? { paid_at: new Date().toISOString() } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        discount_cents: discount,
        total_cents: Math.max(0, gross - discount),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Owner: generate this month's invoice for a subscription from live capacity. */
export const generateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ subscriptionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertOwner, currentPeriodMonth } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { calculateInvoice } = await import("@/lib/billing");

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("id", data.subscriptionId)
      .maybeSingle();
    if (!sub) throw new Error("Subscription not found");
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("id", sub.plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan not found");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breakdown = calculateInvoice(plan as any, sub as any);
    const { data: usage } = await supabaseAdmin
      .from("usage_counters")
      .select("ai_messages")
      .eq("subscription_id", sub.id)
      .eq("period_month", currentPeriodMonth())
      .maybeSingle();

    const { error } = await supabaseAdmin.from("invoices").insert({
      subscription_id: sub.id,
      period_start: sub.current_period_start,
      period_end: sub.current_period_end,
      status: "pending",
      base_cents: breakdown.baseCents,
      extra_classes: breakdown.extraClasses,
      extra_classes_cents: breakdown.extraClassesCents,
      extra_teachers: breakdown.extraTeachers,
      extra_teachers_cents: breakdown.extraTeachersCents,
      extra_student_blocks: breakdown.extraStudentBlocks,
      extra_students_cents: breakdown.extraStudentsCents,
      total_cents: breakdown.totalCents,
      ai_messages_used: usage?.ai_messages ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Owner: reset a subscription's AI message counter for this month. */
export const resetUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ subscriptionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertOwner, currentPeriodMonth } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("usage_counters")
      .update({ ai_messages: 0 })
      .eq("subscription_id", data.subscriptionId)
      .eq("period_month", currentPeriodMonth());
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Owner: read the pricing catalogue. */
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("plans").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Owner: change global pricing and default limits without a deploy. */
export const updatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        base_price_cents: z.number().int().min(0).max(100000000).optional(),
        included_classes: z.number().int().min(0).max(100000).optional(),
        included_teachers: z.number().int().min(0).max(100000).optional(),
        included_students: z.number().int().min(0).max(1000000).optional(),
        included_ai_messages: z.number().int().min(0).max(100000000).optional(),
        extra_class_price_cents: z.number().int().min(0).max(1000000).optional(),
        extra_teacher_price_cents: z.number().int().min(0).max(1000000).optional(),
        student_block_size: z.number().int().min(1).max(10000).optional(),
        extra_student_block_price_cents: z.number().int().min(0).max(1000000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const { error } = await supabaseAdmin.from("plans").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Owner: read global system settings. */
export const listSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("system_settings").select("*");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Owner: toggle maintenance mode, announcements and feature flags. */
export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ key: z.string().min(1).max(80), value: z.record(z.unknown()) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert({ key: data.key, value: data.value as never }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Owner: approve or reject an organization's pending teachers. */
export const setApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ userId: z.string().uuid(), status: z.enum(["approved", "rejected", "pending"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ approval_status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
