import { Radio, Users } from "lucide-react";

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
  const open = stats.filter((item) => item.health !== "settled" && item.category !== "spam").length;
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
