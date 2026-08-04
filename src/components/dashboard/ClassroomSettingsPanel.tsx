import { useEffect, useState } from "react";
import { Bug, Minus, Plus, Settings2 } from "lucide-react";

import { SETTING_LIMITS, clampSetting, type ClassroomSettings } from "@/lib/settings";

type NumericKey = keyof typeof SETTING_LIMITS;

const ORDER: NumericKey[] = [
  "resolve_pct",
  "question_confirm_pct",
  "audio_detect_pct",
  "followup_seconds",
  "spam_sensitivity",
  "cooldown_ms",
  "archive_minutes",
];

/**
 * Every classroom threshold in one place. Owners and administrators edit the
 * organization defaults; teachers tune their own copy when that is allowed.
 */
export function ClassroomSettingsPanel({
  settings,
  saving,
  level,
  canChooseLevel,
  onLevelChange,
  onChange,
  devMode,
  onDevMode,
  studentsOnline = 0,
}: {
  settings: ClassroomSettings;
  saving?: boolean;
  level: "org" | "teacher";
  canChooseLevel: boolean;
  onLevelChange: (level: "org" | "teacher") => void;
  onChange: (patch: Partial<ClassroomSettings>) => void;
  devMode: boolean;
  onDevMode: (on: boolean) => void;
  /** Students currently in the live session — turns percentages into head counts. */
  studentsOnline?: number;
}) {
  const [draft, setDraft] = useState(settings);
  const [openKey, setOpenKey] = useState<NumericKey>("resolve_pct");

  useEffect(() => {
    if (!saving) setDraft(settings);
  }, [settings, saving]);

  const commit = (key: NumericKey, value: number) => {
    const next = clampSetting(key, value);
    setDraft((current) => ({ ...current, [key]: next }));
    if (next !== settings[key]) onChange({ [key]: next } as Partial<ClassroomSettings>);
  };

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Settings2 className="size-4 text-muted-foreground" /> Classroom settings
        </h3>
        <span
          className={`text-[11px] font-medium transition-opacity ${
            saving ? "text-accent opacity-100" : "text-muted-foreground opacity-70"
          }`}
        >
          {saving ? "Saving…" : "Saved"}
        </span>
      </div>

      {canChooseLevel && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {(["org", "teacher"] as const).map((option) => (
            <button
              key={option}
              onClick={() => onLevelChange(option)}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-medium ring-1 transition-colors ${
                level === option
                  ? "bg-accent/15 text-accent ring-accent/40"
                  : "text-muted-foreground ring-border hover:bg-muted"
              }`}
            >
              {option === "org" ? "Organization" : "Just me"}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {ORDER.map((key) => {
          const limit = SETTING_LIMITS[key];
          const open = openKey === key;
          const value = draft[key];
          return (
            <div key={key} className="rounded-lg ring-1 ring-border">
              <button
                onClick={() => setOpenKey(key)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  open ? "bg-muted/60" : "hover:bg-muted/40"
                }`}
              >
                <span>{limit.label}</span>
                <span className="tabular-nums text-accent">
                  {value}
                  {limit.unit}
                </span>
              </button>

              {open && (
                <div className="px-3 pt-1 pb-3">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      aria-label={`Decrease ${limit.label}`}
                      disabled={saving || value <= limit.min}
                      onClick={() => commit(key, value - limit.step)}
                      className="flex size-8 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <div className="min-w-[86px] text-center font-display text-2xl leading-none font-semibold tabular-nums text-accent">
                      {value}
                      <span className="text-sm">{limit.unit}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Increase ${limit.label}`}
                      disabled={saving || value >= limit.max}
                      onClick={() => commit(key, value + limit.step)}
                      className="flex size-8 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  <input
                    type="range"
                    min={limit.min}
                    max={limit.max}
                    step={limit.step}
                    value={value}
                    disabled={saving}
                    aria-label={limit.label}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [key]: Number(event.target.value) }))
                    }
                    onPointerUp={() => commit(key, value)}
                    onKeyUp={() => commit(key, value)}
                    onBlur={() => commit(key, value)}
                    className="mt-3 w-full accent-[var(--accent)]"
                  />
                  <p className="mt-2 text-[11px] text-muted-foreground">{limit.hint}</p>
                  {limit.unit === "%" && (
                    <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-2 text-[11px] leading-relaxed">
                      {studentsOnline > 0 ? (
                        <>
                          <span className="font-semibold tabular-nums text-accent">
                            {Math.max(1, Math.ceil((value / 100) * studentsOnline))} of{" "}
                            {studentsOnline}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {studentsOnline === 1 ? "student" : "students"} online right now
                            {key === "resolve_pct"
                              ? " must mark a topic resolved before it auto-archives."
                              : key === "question_confirm_pct"
                                ? " must join a topic before the rest are asked to confirm."
                                : " must report the same issue before the check runs."}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          No students online yet — this will show the exact head count once your
                          session fills up.
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Bug className="size-3.5 text-muted-foreground" /> Developer mode
        </span>
        <input
          type="checkbox"
          checked={devMode}
          onChange={(event) => onDevMode(event.target.checked)}
          className="size-4 accent-[var(--accent)]"
        />
      </label>
      {devMode && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          AI confidence values are shown on threads and logged to the console.
        </p>
      )}
    </div>
  );
}
