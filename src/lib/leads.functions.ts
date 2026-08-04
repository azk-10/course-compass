import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEAD_STATUSES, PLAN_IDS } from "@/lib/plans";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(160),
  role: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(40),
  country: z.string().trim().min(2).max(80),
  teachers: z.number().int().min(0).max(1000000).nullable(),
  students: z.number().int().min(0).max(10000000).nullable(),
  plan: z.enum(PLAN_IDS as [string, ...string[]]),
  message: z.string().trim().max(2000).optional().default(""),
  consent: z.literal(true),
});

export type LeadInput = z.infer<typeof leadSchema>;

/** Public: stores a sales/demo request. Writes server-side only — leads are never readable by anon. */
export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => leadSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sales_leads").insert({
      name: data.name,
      organization: data.organization,
      role: data.role,
      email: data.email,
      phone: data.phone,
      country: data.country,
      teachers: data.teachers,
      students: data.students,
      plan: data.plan,
      message: data.message ?? "",
      consent: data.consent,
      status: "new",
    });
    if (error) throw new Error("Could not save your request. Please try again.");
    return { ok: true as const };
  });

export type Lead = {
  id: string;
  name: string;
  organization: string;
  role: string;
  email: string;
  phone: string;
  country: string;
  teachers: number | null;
  students: number | null;
  plan: string;
  message: string | null;
  status: string;
  created_at: string;
};

/** Admin only: list every sales request (RLS enforces the admin role). */
export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sales_leads")
      .select(
        "id, name, organization, role, email, phone, country, teachers, students, plan, message, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as Lead[];
  });

/** Admin only: move a lead through the sales pipeline. */
export const updateLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(LEAD_STATUSES) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sales_leads")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
