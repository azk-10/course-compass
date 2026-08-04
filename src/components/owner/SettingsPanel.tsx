import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { listPlans, listSettings, updatePlan, updateSetting } from "@/lib/owner.functions";

const PLAN_FIELDS: { key: string; label: string; money?: boolean }[] = [
  { key: "base_price_cents", label: "Base price", money: true },
  { key: "included_classes", label: "Included classes" },
  { key: "included_teachers", label: "Included teachers" },
  { key: "included_students", label: "Included students" },
  { key: "included_ai_messages", label: "Included AI messages" },
  { key: "extra_class_price_cents", label: "Extra class price", money: true },
  { key: "extra_teacher_price_cents", label: "Extra teacher price", money: true },
  { key: "student_block_size", label: "Student block size" },
  { key: "extra_student_block_price_cents", label: "Price per student block", money: true },
];

export function SettingsPanel() {
  const fetchPlans = useServerFn(listPlans);
  const fetchSettings = useServerFn(listSettings);
  const patchPlan = useServerFn(updatePlan);
  const patchSetting = useServerFn(updateSetting);
  const qc = useQueryClient();

  const plans = useQuery({ queryKey: ["owner-plans"], queryFn: () => fetchPlans({}) });
  const settings = useQuery({ queryKey: ["owner-settings"], queryFn: () => fetchSettings({}) });

  const savePlan = useMutation({
    mutationFn: (input: Record<string, unknown>) => patchPlan({ data: input as never }),
    onSuccess: () => {
      toast.success("Pricing updated for every future invoice");
      qc.invalidateQueries({ queryKey: ["owner-plans"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save pricing"),
  });

  const saveSetting = useMutation({
    mutationFn: (input: { key: string; value: Record<string, unknown> }) =>
      patchSetting({ data: input as never }),
    onSuccess: () => {
      toast.success("Setting saved");
      qc.invalidateQueries({ queryKey: ["owner-settings"] });
    },
  });

  if (plans.isLoading || settings.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  const settingValue = (key: string) =>
    ((settings.data ?? []).find((s) => s.key === key)?.value ?? {}) as Record<string, unknown>;
  const maintenance = settingValue("maintenance_mode");
  const announcement = settingValue("announcement");

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-bold">Global pricing</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Stored in the database — changing a number here changes every future invoice, no deploy
          needed.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {(plans.data ?? []).map((plan) => (
            <div key={plan.id} className="rounded-xl border border-border bg-card p-4">
              <h4 className="font-bold">{plan.name}</h4>
              <p className="text-xs text-muted-foreground capitalize">{plan.kind}</p>
              {plan.is_custom ? (
                <p className="mt-4 rounded-md bg-secondary/60 p-3 text-xs/5 text-muted-foreground">
                  Enterprise is quoted per customer. Set a custom base price directly on the
                  account in the Academies or Teachers tab.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {PLAN_FIELDS.map((field) => (
                    <PlanField
                      key={field.key}
                      label={field.label}
                      money={field.money}
                      value={(plan as unknown as Record<string, number>)[field.key] ?? 0}
                      onCommit={(value) => savePlan.mutate({ id: plan.id, [field.key]: value })}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold">System</h3>
        <ToggleRow
          label="Maintenance mode"
          description="Shows a maintenance notice instead of the app."
          checked={Boolean(maintenance["enabled"])}
          onChange={(enabled) =>
            saveSetting.mutate({ key: "maintenance_mode", value: { ...maintenance, enabled } })
          }
        />
        <ToggleRow
          label="Announcement banner"
          description="Displays a message across the top of the app."
          checked={Boolean(announcement["enabled"])}
          onChange={(enabled) =>
            saveSetting.mutate({ key: "announcement", value: { ...announcement, enabled } })
          }
        />
        <label className="block">
          <span className="text-xs text-muted-foreground">Announcement message</span>
          <input
            defaultValue={String(announcement["message"] ?? "")}
            onBlur={(e) =>
              saveSetting.mutate({
                key: "announcement",
                value: { ...announcement, message: e.target.value },
              })
            }
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            placeholder="Scheduled maintenance on Sunday…"
          />
        </label>
      </section>
    </div>
  );
}

function PlanField({
  label,
  value,
  money,
  onCommit,
}: {
  label: string;
  value: number;
  money?: boolean;
  onCommit: (value: number) => void;
}) {
  const display = money ? String(value / 100) : String(value);
  const [local, setLocal] = useState(display);
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        {money && <span className="text-xs text-muted-foreground">$</span>}
        <input
          type="number"
          min={0}
          step={money ? 1 : 1}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            const next = Number(local);
            if (!Number.isFinite(next) || next < 0) return;
            const cents = money ? Math.round(next * 100) : Math.round(next);
            if (cents !== value) onCommit(cents);
          }}
          className="w-24 rounded-md border border-border bg-card px-2 py-1 text-right text-sm"
        />
      </span>
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[hsl(var(--primary))]"
      />
    </label>
  );
}
