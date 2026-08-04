import { useState } from "react";
import { Zap } from "lucide-react";

const ACCENTS = ["amber", "teal", "violet", "rose"];

export function NewCourseDialog({
  open,
  pending,
  onClose,
  onCreate,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    term: string | null;
    accent: string;
    isCrash: boolean;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState("");
  const [accent, setAccent] = useState(ACCENTS[0]!);
  const [isCrash, setIsCrash] = useState(false);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || pending) return;
    onCreate({
      title: title.trim(),
      term: term.trim() || null,
      accent,
      isCrash,
    });
    setTitle("");
    setTerm("");
    setIsCrash(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="panel w-full max-w-md space-y-4 p-6"
      >
        <div>
          <h2 className="font-display text-lg font-semibold">New course</h2>
          <p className="text-sm text-muted-foreground">
            Set up a full course or a short crash course.
          </p>
        </div>

        <div>
          <label htmlFor="course-title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="course-title"
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="Thermodynamics crash course"
            className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="course-term" className="text-sm font-medium">
            Term <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="course-term"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            maxLength={40}
            placeholder="Autumn 2026"
            className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <p className="text-sm font-medium">Accent</p>
          <div className="mt-2 flex gap-2">
            {ACCENTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAccent(value)}
                className={`rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
                  accent === value ? "border-accent bg-secondary" : "border-border"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-lg bg-secondary px-3 py-3">
          <input
            type="checkbox"
            checked={isCrash}
            onChange={(event) => setIsCrash(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Zap className="size-3.5 text-accent" /> Crash course
            </span>
            <span className="block text-xs text-muted-foreground">
              Short, intensive format — highlighted in your sidebar.
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create course"}
          </button>
        </div>
      </form>
    </div>
  );
}
