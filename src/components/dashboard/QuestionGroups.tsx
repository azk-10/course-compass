import { CheckCircle2, CircleHelp, ListChecks, MessageSquareText } from "lucide-react";
import type { QuestionGroup, ResponseRow } from "@/lib/dashboard-data";

const kindMeta: Record<string, { label: string; icon: typeof ListChecks }> = {
  multiple_choice: { label: "Multiple choice", icon: ListChecks },
  true_false: { label: "True / false", icon: CheckCircle2 },
  short_answer: { label: "Short answer", icon: MessageSquareText },
};

export function QuestionGroups({
  groups,
  responses,
  liveSessionId,
  onAsk,
}: {
  groups: QuestionGroup[];
  responses: ResponseRow[];
  liveSessionId: string | null;
  onAsk: (questionId: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="panel p-8 text-center text-sm text-muted-foreground">
        No question groups in this course yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.id} className="panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="font-display text-sm font-semibold">{group.name}</h3>
            <span className="text-xs text-muted-foreground">
              {group.questions.length} question{group.questions.length === 1 ? "" : "s"}
            </span>
          </header>
          <ul className="divide-y divide-border">
            {group.questions.map((q, i) => {
              const meta = kindMeta[q.kind] ?? { label: q.kind, icon: CircleHelp };
              const Icon = meta.icon;
              const answered = responses.filter((r) => r.question_id === q.id).length;
              return (
                <li key={q.id} className="flex items-start gap-4 px-5 py-4">
                  <span className="mt-0.5 font-display text-xs text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{q.prompt}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Icon className="size-3.5" /> {meta.label}
                      </span>
                      <span>
                        {q.points} pt{q.points === 1 ? "" : "s"}
                      </span>
                      {answered > 0 && (
                        <span className="text-success">{answered} answered</span>
                      )}
                    </div>
                    {q.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {q.options.map((opt) => (
                          <span
                            key={opt}
                            className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onAsk(q.id)}
                    disabled={!liveSessionId}
                    className="shrink-0 rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-40"
                  >
                    Ask now
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
