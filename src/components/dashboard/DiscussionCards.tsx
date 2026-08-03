import { MessageSquareText, Radio, Users } from "lucide-react";

import type { MessageGroup } from "@/lib/grouping";

/**
 * The teacher only ever sees merged classroom intent — never the raw feed.
 */
export function DiscussionCards({
  groups,
  isLoading,
  activeId,
  onDiscuss,
  emptyLabel = "No questions yet — merged discussions appear here as students write.",
}: {
  groups: MessageGroup[];
  isLoading?: boolean;
  activeId?: string | null;
  onDiscuss: (group: MessageGroup) => void;
  emptyLabel?: string;
}) {
  if (isLoading) {
    return <Empty label="Reading the classroom…" />;
  }
  if (groups.length === 0) {
    return <Empty label={emptyLabel} />;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <ul className="grid gap-3">
        {groups.map((group) => {
          const active = group.messages.some((message) => message.id === activeId);
          return (
            <li
              key={group.key}
              className={`panel p-4 transition-colors ${
                active ? "bg-accent/10 ring-1 ring-accent/40" : ""
              }`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold break-words">
                    {group.label}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    Asked by {group.students} student{group.students === 1 ? "" : "s"}
                    <span aria-hidden>·</span>
                    {group.messages.length} message{group.messages.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDiscuss(group)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "border border-input hover:bg-secondary"
                  }`}
                >
                  <Radio className="size-4" />
                  {active ? "Discussing" : "Discuss"}
                </button>
              </div>

              <div className="mt-3 rounded-lg bg-secondary px-3 py-2">
                <p className="text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
                  Examples
                </p>
                <ul className="mt-1 space-y-0.5">
                  {group.examples.map((example) => (
                    <li key={example} className="text-sm break-words text-foreground/90">
                      • {example}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
        <MessageSquareText className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
