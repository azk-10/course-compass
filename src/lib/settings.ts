import { supabase } from "@/integrations/supabase/client";

/**
 * Every threshold the classroom intelligence uses lives here. An organization
 * row provides the defaults; an individual teacher row may override them when
 * the organization allows it. Independent teachers only ever have their own row.
 */
export type ClassroomSettings = {
  question_confirm_pct: number;
  audio_detect_pct: number;
  resolve_pct: number;
  followup_seconds: number;
  spam_sensitivity: number;
  cooldown_ms: number;
  archive_minutes: number;
  allow_teacher_override: boolean;
};

export const DEFAULT_SETTINGS: ClassroomSettings = {
  question_confirm_pct: 60,
  audio_detect_pct: 50,
  resolve_pct: 75,
  followup_seconds: 75,
  spam_sensitivity: 50,
  cooldown_ms: 2000,
  archive_minutes: 10,
  allow_teacher_override: true,
};

export const SETTING_LIMITS: Record<
  keyof Omit<ClassroomSettings, "allow_teacher_override">,
  { min: number; max: number; step: number; label: string; unit: string; hint: string }
> = {
  question_confirm_pct: {
    min: 30,
    max: 90,
    step: 5,
    label: "Question confirmation",
    unit: "%",
    hint: "Once this share of the class joins a thread, everyone else is asked if they have the same question.",
  },
  audio_detect_pct: {
    min: 20,
    max: 90,
    step: 5,
    label: "Audio detection",
    unit: "%",
    hint: "Share of recent technical messages about sound needed to trigger the “Can you hear the teacher?” poll.",
  },
  resolve_pct: {
    min: 40,
    max: 100,
    step: 5,
    label: "Resolution threshold",
    unit: "%",
    hint: "A thread auto-archives once this share of the students who responded say they got it.",
  },
  followup_seconds: {
    min: 30,
    max: 180,
    step: 15,
    label: "Follow-up delay",
    unit: "s",
    hint: "Quiet time before thread members are asked “Did that answer your question?”.",
  },
  spam_sensitivity: {
    min: 0,
    max: 100,
    step: 10,
    label: "Spam sensitivity",
    unit: "%",
    hint: "Higher values filter more aggressively into the spam tab.",
  },
  cooldown_ms: {
    min: 0,
    max: 10000,
    step: 500,
    label: "Message cooldown",
    unit: "ms",
    hint: "Minimum gap between two messages from the same student.",
  },
  archive_minutes: {
    min: 2,
    max: 60,
    step: 1,
    label: "Thread archive delay",
    unit: "min",
    hint: "Silent threads fade out after this long — they reopen automatically if the question returns.",
  },
};

const FIELDS =
  "question_confirm_pct, audio_detect_pct, resolve_pct, followup_seconds, spam_sensitivity, cooldown_ms, archive_minutes, allow_teacher_override";

export type SettingsScope = { organizationId: string | null; teacherId: string };

/** Organization defaults merged with the teacher's own overrides. */
export async function fetchSettings(scope: SettingsScope): Promise<ClassroomSettings> {
  const [org, mine] = await Promise.all([
    scope.organizationId
      ? supabase
          .from("classroom_settings")
          .select(FIELDS)
          .eq("organization_id", scope.organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("classroom_settings")
      .select(FIELDS)
      .eq("teacher_id", scope.teacherId)
      .maybeSingle(),
  ]);

  const base = { ...DEFAULT_SETTINGS, ...(org.data ?? {}) } as ClassroomSettings;
  if (!mine.data) return base;
  if (!base.allow_teacher_override && scope.organizationId) return base;
  return { ...base, ...mine.data } as ClassroomSettings;
}

export async function saveSettings(
  scope: { organizationId: string | null; teacherId: string; level: "org" | "teacher" },
  patch: Partial<ClassroomSettings>,
): Promise<void> {
  const row =
    scope.level === "org" && scope.organizationId
      ? { organization_id: scope.organizationId, teacher_id: null }
      : { teacher_id: scope.teacherId, organization_id: null };

  const { error } = await supabase
    .from("classroom_settings")
    .upsert({ ...row, ...patch } as never, {
      onConflict: scope.level === "org" ? "organization_id" : "teacher_id",
    });
  if (error) throw error;
}

/** Clamps a value to the documented range for a setting. */
export function clampSetting(key: keyof typeof SETTING_LIMITS, value: number): number {
  const limit = SETTING_LIMITS[key];
  const stepped = Math.round(value / limit.step) * limit.step;
  return Math.min(limit.max, Math.max(limit.min, stepped));
}
