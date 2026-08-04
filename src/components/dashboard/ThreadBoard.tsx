import { useEffect, useRef, useState } from "react";
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
import { readDevMode } from "@/lib/logs";
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
 * Threads reorder constantly as priority shifts, so movement is animated with a
 * FLIP pass: measure, let React reorder, then play the delta back.
 */
function useFlipList(signature: string) {
  const ref = useRef<HTMLUListElement>(null);
  const positions = useRef(new Map<string, number>());

  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const children = Array.from(list.children) as HTMLElement[];
    for (const child of children) {
      const key = child.dataset["threadId"];
      if (!key) continue;
      const top = child.getBoundingClientRect().top;
      const previous = positions.current.get(key);
      if (previous !== undefined && Math.abs(previous - top) > 1) {
        child.animate(
          [{ transform: `translateY(${previous - top}px)` }, { transform: "translateY(0)" }],
          { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
      positions.current.set(key, top);
    }
  }, [signature]);

  return ref;
}

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
  const listRef = useFlipList(stats.map((item) => item.thread.id).join(","));
  // Off-topic chatter and spam never belong on the topic board — they live in
  // their own sidebar tabs and only appear here inside the collapsed drawer.
  const isAside = (item: ThreadStats) => item.category === "spam" || item.category === "general";
  const real = stats.filter((item) => !isAside(item));
  const spam = stats.filter(isAside);
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
      {active.length === 0 && settled.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No teaching topics right now — only off-topic chatter, tucked away below.
        </p>
      )}

      <ul ref={listRef} className="grid gap-3">
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
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${showSpam ? "" : "-rotate-90"}`}
            />
            Filtered out · {spam.length} off-topic & spam thread{spam.length === 1 ? "" : "s"}
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
  const category = CATEGORY_META[item.category];
  const Icon = meta.icon;
  const devMode = readDevMode();
  const confidence = messages
    .filter((message) => message.thread_id === item.thread.id && message.confidence !== null)
    .slice(-1)[0]?.confidence;
  const examples = messages
    .filter((message) => message.thread_id === item.thread.id && !message.is_teacher)
    .slice(-3)
    .map((message) => message.body);

  return (
    <li
      data-thread-id={item.thread.id}
      className={`panel rise-in p-4 transition-shadow ${meta.bg} ${meta.ring}`}
    >
      {devMode && confidence !== null && confidence !== undefined && (
        <span className="float-right ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.6rem] text-muted-foreground">
          ai {Number(confidence).toFixed(2)}
        </span>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold break-words">{item.thread.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${category.text}`}>
              <span className={`size-2 rounded-full ${category.dot}`} />
              {category.label}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {item.students} student{item.students === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowUp className="size-3.5" />
              {item.upvotes} upvote{item.upvotes === 1 ? "" : "s"}
            </span>
            {item.category === "question" && (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                {item.resolvedPct}% got it
              </span>
            )}
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
            <li
              key={`${item.thread.id}-${index}`}
              className="text-sm break-words text-foreground/90"
            >
              • {example}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
