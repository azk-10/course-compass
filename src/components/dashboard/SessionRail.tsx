import { Radio, Users } from "lucide-react";

import type { ChatMessage } from "@/lib/live-chat";
import type { Session } from "@/lib/dashboard-data";

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
}: {
  messages: ChatMessage[];
  online: number;
  session: Session | null;
}) {
  const answers = messages.filter((message) => message.message_type === "answer").length;
  const questions = messages.filter(
    (message) => message.message_type !== "answer" && !message.is_teacher,
  ).length;
  const minutes = session
    ? Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000))
    : 0;

  const items = [
    { label: "Messages", value: questions },
    { label: "Answers", value: answers },
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

export function CurrentDiscussion({
  message,
  onClear,
}: {
  message: ChatMessage | null;
  onClear: () => void;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Radio className="size-4 text-accent" /> Currently discussing
        </h3>
        {message && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {message ? (
        <div className="mt-3 rounded-lg bg-accent/12 px-3 py-2.5 ring-1 ring-accent/30">
          <p className="text-xs font-semibold text-accent">{message.sender_label}</p>
          <p className="mt-0.5 text-sm break-words">{message.body}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Click any message in the feed to highlight it for the whole class.
        </p>
      )}
    </div>
  );
}
