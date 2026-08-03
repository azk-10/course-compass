import { useEffect, useRef } from "react";
import { Pin } from "lucide-react";

import type { ChatMessage } from "@/lib/live-chat";

function time(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Raw, chronological feed. Grouping can later replace the body of this list
 * without changing storage or the surrounding layout.
 */
export function LiveFeed({
  messages,
  isLoading,
  pinnedId,
  onPin,
  emptyLabel = "No messages yet.",
  selfLabel,
}: {
  messages: ChatMessage[];
  isLoading?: boolean;
  pinnedId?: string | null;
  onPin?: (message: ChatMessage) => void;
  emptyLabel?: string;
  selfLabel?: string;
}) {
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading messages…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-0.5">
          {messages.map((message) => {
            const pinned = message.id === pinnedId;
            const isAnswer = message.message_type === "answer";
            return (
              <li key={message.id}>
                <button
                  type="button"
                  disabled={!onPin}
                  onClick={() => onPin?.(message)}
                  className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    pinned ? "bg-accent/15 ring-1 ring-accent/40" : onPin ? "hover:bg-secondary" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          message.is_teacher
                            ? "text-accent"
                            : message.sender_label === selfLabel
                              ? "text-primary"
                              : "text-foreground"
                        }`}
                      >
                        {message.sender_label}
                        {message.is_teacher && " · teacher"}
                      </span>
                      {isAnswer && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.6rem] font-medium tracking-wide uppercase">
                          Answer
                        </span>
                      )}
                      <span className="text-[0.68rem] text-muted-foreground">
                        {time(message.created_at)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm break-words whitespace-pre-wrap">
                      {message.body}
                    </span>
                  </span>
                  {onPin && (
                    <Pin
                      className={`mt-1 size-3.5 shrink-0 transition-opacity ${
                        pinned ? "text-accent opacity-100" : "opacity-0 group-hover:opacity-50"
                      }`}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
