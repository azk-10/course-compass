import { useEffect, useRef, useState } from "react";
import { MoreVertical, MicOff, Pause, Play, ShieldAlert, UserX, Undo2 } from "lucide-react";

import type { SessionBlock } from "@/lib/moderation";

/** Emergency controls. Destructive actions always ask for confirmation first. */
export function SafetyMenu({
  paused,
  students,
  blocks,
  busy,
  onPause,
  onMute,
  onRemove,
  onLift,
}: {
  paused: boolean;
  students: string[];
  blocks: SessionBlock[];
  busy?: boolean;
  onPause: (paused: boolean) => void;
  onMute: (label: string, minutes: number) => void;
  onRemove: (label: string) => void;
  onLift: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const selected = target || students[0] || "";

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Safety controls"
        aria-expanded={open}
        className="rounded-lg border border-input p-2 transition-colors hover:bg-secondary"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
          <p className="flex items-center gap-2 text-xs font-semibold">
            <ShieldAlert className="size-3.5 text-warning" /> Safety controls
          </p>

          <button
            onClick={() => onPause(!paused)}
            disabled={busy}
            className="mt-3 inline-flex w-full items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {paused ? "Resume chat" : "Pause chat"}
          </button>

          <label className="mt-3 block text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            Student
          </label>
          <select
            value={selected}
            onChange={(event) => setTarget(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent"
          >
            {students.length === 0 && <option value="">No students yet</option>}
            {students.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => selected && onMute(selected, 5)}
              disabled={!selected || busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <MicOff className="size-3.5" /> Mute 5 min
            </button>
            <button
              onClick={() => {
                if (!selected) return;
                if (confirm(`Remove ${selected} from this session?`)) onRemove(selected);
              }}
              disabled={!selected || busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input px-2 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <UserX className="size-3.5" /> Remove
            </button>
          </div>

          {blocks.length > 0 && (
            <div className="mt-3 border-t border-border pt-2">
              <p className="text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
                Restricted
              </p>
              <ul className="mt-1 space-y-1">
                {blocks.map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">
                      {block.student_label}
                      <span className="text-muted-foreground">
                        {" "}
                        · {block.kind === "remove" ? "removed" : "muted"}
                      </span>
                    </span>
                    <button
                      onClick={() => onLift(block.student_label)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[0.68rem] font-semibold hover:bg-secondary"
                    >
                      <Undo2 className="size-3" /> Undo
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
