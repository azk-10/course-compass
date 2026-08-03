import { useState } from "react";
import {
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Flame,
  MessageSquare,
  TriangleAlert,
  Users,
} from "lucide-react";

import { CATEGORY_META } from "@/lib/classify";
import type { ChatMessage } from "@/lib/live-chat";
import type { ThreadStats } from "@/lib/threads";

const HEALTH = {
  new: {
    label: "New",
    ring: "ring-1 ring-info/40",
    bg: "bg-info/8",
    text: "text-info",
    icon: MessageSquare,
  },
  attention: {
    label: "Needs attention",
    ring: "ring-1 ring-warning/50",
    bg: "bg-warning/10",
    text: "text-warning",
    icon: TriangleAlert,
  },
  urgent: {
    label: "Urgent",
    ring: "ring-1 ring-destructive/60",
    bg: "bg-destructive/10",
    text: "text-destructive",
    icon: Flame,
  },
  settled: {
    label: "Resolved",
    ring: "",
    bg: "",
    text: "text-muted-foreground",
    icon: CheckCircle2,
  },
} as const;

/**
 * The teacher only reads merged threads, ordered by classroom priority.
 * No teacher action is required — students drive every state change.
 */
export function ThreadBoard({
  stats,
  messages,
  isLoading,
}: {
  stats: ThreadStats[];
  messages: ChatMessage[];
  isLoading?: boolean;
}) {
  const [showSpam, setShowSpam] = useState(false);
  const real = stats.filter((item) => item.category !== "spam");
  const spam = stats.filter((item) => item.category === "spam");
  const active = real.filter((item) => item.health !== "settled");
  const settled = real.filter((item) => item.health === "settled");

  if (isLoading) {
    return <p className="flex-1 px-6 py-8 text-sm text-muted-foreground">Reading the classroom…</p>;
  }
  if (stats.length === 0) {
    return (
      <p className="flex-1 px-6 py-10 text-center text-sm text-muted-foreground">
        Waiting for your class — similar questions merge into one thread automatically.
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <ul className="grid gap-3">
        {active.map((item) => (
          <ThreadCard key={item.thread.id} item={item} messages={messages} />
        ))}
      </ul>

      {settled.length > 0 && (
        <div className="mt-6">
          <p className="text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            Auto-archived · class says they got it
          </p>
          <ul className="mt-2 grid gap-2 opacity-45">
            {settled.map((item) => (
              <ThreadCard key={item.thread.id} item={item} messages={messages} compact />
            ))}
          </ul>
        </div>
      )}

      {spam.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowSpam((open) => !open)}
            className="inline-flex items-center gap-1.5 text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase hover:text-foreground"
          >
            <ChevronDown className={`size-3.5 transition-transform ${showSpam ? "" : "-rotate-90"}`} />
            Filtered out · {spam.length} spam thread{spam.length === 1 ? "" : "s"}
          </button>
          {showSpam && (
            <ul className="mt-2 grid gap-2 opacity-60">
              {spam.map((item) => (
                <ThreadCard key={item.thread.id} item={item} messages={messages} compact />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


function ThreadCard({
  item,
  messages,
  compact,
}: {
  item: ThreadStats;
  messages: ChatMessage[];
  compact?: boolean;
}) {
  const meta = HEALTH[item.health];
  const Icon = meta.icon;
  const examples = messages
    .filter((message) => message.thread_id === item.thread.id && !message.is_teacher)
    .slice(-3)
    .map((message) => message.body);

  return (
    <li className={`panel p-4 ${meta.bg} ${meta.ring}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold break-words">{item.thread.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {item.students} student{item.students === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowUp className="size-3.5" />
              {item.upvotes} upvote{item.upvotes === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              {item.resolvedPct}% got it
            </span>

          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.text}`}
        >
          <Icon className="size-3.5" />
          {meta.label}
        </span>
      </div>

      {!compact && examples.length > 0 && (
        <ul className="mt-3 space-y-0.5 rounded-lg bg-secondary px-3 py-2">
          {examples.map((example, index) => (
            <li key={`${item.thread.id}-${index}`} className="text-sm break-words text-foreground/90">
              • {example}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
