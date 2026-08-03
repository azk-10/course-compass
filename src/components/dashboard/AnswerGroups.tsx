import { CheckCircle2, Users } from "lucide-react";

import type { MessageGroup } from "@/lib/grouping";

/**
 * Answers are merged by meaning ("39", "Thirty Nine", "039" are one card).
 * Selecting a card marks it as the correct answer for the whole class.
 */
export function AnswerGroups({
  groups,
  isLoading,
  correctId,
  onMarkCorrect,
}: {
  groups: MessageGroup[];
  isLoading?: boolean;
  correctId?: string | null;
  onMarkCorrect: (group: MessageGroup) => void;
}) {
  const total = groups.reduce((sum, group) => sum + group.students, 0);

  if (isLoading) {
    return <p className="flex-1 px-6 py-8 text-sm text-muted-foreground">Collecting answers…</p>;
  }
  if (groups.length === 0) {
    return (
      <p className="flex-1 px-6 py-8 text-sm text-muted-foreground">
        No answers yet — merged answers appear here as students respond.
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <ul className="grid gap-3">
        {groups.map((group) => {
          const correct = group.messages.some((message) => message.id === correctId);
          const share = total ? Math.round((group.students / total) * 100) : 0;
          return (
            <li key={group.key}>
              <button
                type="button"
                onClick={() => onMarkCorrect(group)}
                className={`panel w-full p-4 text-left transition-colors ${
                  correct ? "bg-success/10 ring-1 ring-success/50" : "hover:bg-secondary"
                }`}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-semibold break-words">
                      {group.label}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      {group.students} student{group.students === 1 ? "" : "s"} · {share}%
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      correct
                        ? "bg-success/20 text-success"
                        : "border border-input text-muted-foreground"
                    }`}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {correct ? "Correct" : "Mark correct"}
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={correct ? "h-full bg-success" : "h-full bg-accent"}
                    style={{ width: `${share}%` }}
                  />
                </div>

                {group.examples.length > 1 && (
                  <p className="mt-2 text-xs break-words text-muted-foreground">
                    {group.examples.slice(0, 5).join(" · ")}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
