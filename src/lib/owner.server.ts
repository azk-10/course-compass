import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies the caller holds the platform `owner` role. Uses the caller's own
 * RLS-scoped client so a forged request can never escalate.
 */
export async function assertOwner(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("is_owner", { _user_id: userId });
  if (error || data !== true) throw new Error("Forbidden");
}

export function currentPeriodMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
