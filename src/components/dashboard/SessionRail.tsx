import { Minus, Plus, Radio, Settings2, Users } from "lucide-react";
import { useEffect, useState } from "react";


import { toCategory } from "@/lib/classify";
import type { ChatMessage } from "@/lib/live-chat";

import type { Session } from "@/lib/dashboard-data";
import type { ThreadStats } from "@/lib/threads";

export function StudentsOnline({ names }: { names: string[] }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Users className="size-4 text-muted-foreground" /> Students online
        </h3>
        <span className="text-xs text-muted-foreground">{names.length}</span>
      </div>
      {names.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nobody has written yet.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {names.slice(0, 40).map((name) => (
            <span key={name} className="rounded-full bg-secondary px-2.5 py-1 text-xs">
              {name}
            </span>
          ))}
          {names.length > 40 && (
            <span className="px-1 py-1 text-xs text-muted-foreground">
              +{names.length - 40} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function QuickStats({
  messages,
  online,
  session,
  stats,
}: {
  messages: ChatMessage[];
  online: number;
  session: Session | null;
  stats: ThreadStats[];
}) {
  const answers = messages.filter((message) => toCategory(message.category) === "answer").length;
  const issues = stats.filter((item) => item.category === "technical").length;
  const upvotes = stats.reduce((sum, item) => sum + item.upvotes, 0);
  const open = stats.filter(
    (item) => item.health !== "settled" && item.category !== "spam",
  ).length;
  const minutes = session
    ? Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000))
    : 0;

  const items = [
    { label: "Open threads", value: open },
    { label: "Upvotes", value: upvotes },
    { label: "Answers", value: answers },
    { label: "Tech issues", value: issues },
    { label: "Online", value: online },
    { label: "Minutes", value: minutes },
  ];


  return (
    <div className="panel p-5">
      <h3 className="font-display text-sm font-semibold">Quick statistics</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-secondary px-3 py-2">
            <dt className="text-[0.68rem] tracking-[0.1em] text-muted-foreground uppercase">
              {item.label}
            </dt>
            <dd className="font-display text-xl font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const PRESETS = [
  { value: 50, label: "Half", hint: "Archive early, keep the board clear" },
  { value: 75, label: "Balanced", hint: "Recommended for most classes" },
  { value: 90, label: "Strict", hint: "Keep threads open until nearly everyone gets it" },
];

/** The only setting a teacher ever touches. */
export function ThreadSettings({
  threshold,
  onChange,
  disabled,
}: {
  threshold: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(threshold);
  const dirty = draft !== threshold;

  useEffect(() => {
    if (!disabled) setDraft(threshold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, disabled]);

  const commit = (value: number) => {
    const next = Math.min(100, Math.max(40, Math.round(value / 5) * 5));
    setDraft(next);
    if (next !== threshold) onChange(next);
  };

  const example = Math.ceil((draft / 100) * 20);

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Settings2 className="size-4 text-muted-foreground" /> Resolve threshold
        </h3>
        <span
          className={`text-[11px] font-medium transition-opacity ${
            disabled ? "text-accent opacity-100" : dirty ? "opacity-0" : "text-muted-foreground opacity-70"
          }`}
        >
          {disabled ? "Saving…" : "Saved"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Decrease threshold"
          disabled={disabled || draft <= 40}
          onClick={() => commit(draft - 5)}
          className="flex size-9 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <div className="min-w-[104px] text-center">
          <div className="font-display text-4xl leading-none font-semibold tabular-nums text-accent">
            {draft}
            <span className="text-xl">%</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">of responding students</p>
        </div>
        <button
          type="button"
          aria-label="Increase threshold"
          disabled={disabled || draft >= 100}
          onClick={() => commit(draft + 5)}
          className="flex size-9 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <input
        id="threshold"
        type="range"
        min={40}
        max={100}
        step={5}
        value={draft}
        disabled={disabled}
        aria-label="Auto-archive threshold"
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={() => commit(draft)}
        onKeyUp={() => commit(draft)}
        onBlur={() => commit(draft)}
        className="mt-4 w-full accent-[var(--accent)]"
      />

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {PRESETS.map((preset) => {
          const active = draft === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              title={preset.hint}
              disabled={disabled}
              onClick={() => commit(preset.value)}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-medium ring-1 transition-colors ${
                active
                  ? "bg-accent/15 text-accent ring-accent/40"
                  : "text-muted-foreground ring-border hover:bg-muted"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        A thread auto-archives once <span className="font-medium text-foreground">{draft}%</span> of
        the students who responded mark it resolved — about{" "}
        <span className="font-medium text-foreground">{example} of 20</span>. It comes back
        automatically if someone asks again.
      </p>
    </div>
  );
}


export function TopThread({ item }: { item: ThreadStats | null }) {
  return (
    <div className="panel p-5">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
        <Radio className="size-4 text-accent" /> Highest priority
      </h3>
      {item ? (
        <div className="mt-3 rounded-lg bg-accent/12 px-3 py-2.5 ring-1 ring-accent/30">
          <p className="text-sm font-medium break-words">{item.thread.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.students} students · {item.upvotes} upvotes · {item.resolvedPct}% resolved
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing urgent — the class is following along.
        </p>
      )}
    </div>
  );
}
