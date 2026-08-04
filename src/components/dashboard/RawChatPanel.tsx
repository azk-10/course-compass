import { useEffect, useState } from "react";
import { Coffee, HelpCircle, Layers, MessageSquare, ShieldAlert, Wrench } from "lucide-react";

import { CATEGORY_META, toCategory, type Category } from "@/lib/classify";
import type { ChatMessage } from "@/lib/live-chat";

export type ChatTab = "topics" | "all" | Category;

export const CHAT_TABS: { key: ChatTab; label: string; icon: typeof MessageSquare }[] = [
  { key: "topics", label: "Topic chats", icon: Layers },
  { key: "all", label: "All chat", icon: MessageSquare },
  { key: "question", label: "Questions", icon: HelpCircle },
  { key: "technical", label: "Technical", icon: Wrench },
  { key: "general", label: "Off-topic", icon: Coffee },
  { key: "spam", label: "Spam", icon: ShieldAlert },
];

function studentMessages(messages: ChatMessage[]) {
  return messages.filter((message) => !message.is_teacher);
}

export function filterByTab(messages: ChatMessage[], tab: ChatTab) {
  const students = studentMessages(messages);
  if (tab === "all" || tab === "topics") return students;
  return students.filter((message) => toCategory(message.category) === tab);
}

/**
 * Per-tab "already read" marker. Once the teacher opens a tab its badge clears,
 * and only messages that arrive afterwards count again.
 */
function useSeenMarks(sessionKey: string, tab: ChatTab, messages: ChatMessage[]) {
  const storageKey = `cc-chat-seen-${sessionKey}`;
  const [seen, setSeen] = useState<Record<string, string>>({});

  // Reload marks whenever the session changes.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setSeen(raw ? (JSON.parse(raw) as Record<string, string>) : {});
    } catch {
      setSeen({});
    }
  }, [storageKey]);

  // While a tab is open, everything visible in it is considered read.
  useEffect(() => {
    if (tab === "topics") return;
    const list = filterByTab(messages, tab);
    const latest = list.reduce((max, m) => (m.created_at > max ? m.created_at : max), "");
    if (!latest) return;
    setSeen((prev) => {
      if ((prev[tab] ?? "") >= latest) return prev;
      const next = { ...prev, [tab]: latest };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage is best-effort */
      }
      return next;
    });
  }, [tab, messages, storageKey]);

  return (key: ChatTab) =>
    filterByTab(messages, key).filter((m) => m.created_at > (seen[key] ?? "")).length;
}

/**
 * Sidebar navigation for the raw Zoom-style transcript. Badges show what is
 * still *unread* per category, and how many topic threads are still unresolved.
 */
export function ChatTabList({
  messages,
  tab,
  onChange,
  threadCount,
  sessionKey = "none",
  collapsed = false,
}: {
  messages: ChatMessage[];
  tab: ChatTab;
  onChange: (tab: ChatTab) => void;
  /** Threads still awaiting resolution. */
  threadCount: number;
  sessionKey?: string;
  collapsed?: boolean;
}) {
  const unreadFor = useSeenMarks(sessionKey, tab, messages);

  return (
    <nav className={`flex flex-col gap-1 pb-4 ${collapsed ? "px-2" : "px-3"}`}>
      {CHAT_TABS.map(({ key, label, icon: Icon }) => {
        const count = key === "topics" ? threadCount : unreadFor(key);
        const active = tab === key;

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={collapsed ? `${label} (${count})` : undefined}
            aria-label={label}
            className={`relative inline-flex items-center gap-2 overflow-hidden rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
              collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2"
            } ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "opacity-75 hover:bg-sidebar-accent/50 hover:opacity-100"
            }`}
          >
            {active && (
              <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-sidebar-primary" />
            )}
            <Icon
              className={`size-4 shrink-0 transition-transform duration-200 ${active ? "scale-110" : ""}`}
            />

            {collapsed ? (
              count > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-sidebar-primary px-1 text-[0.55rem] leading-4 font-semibold text-sidebar-primary-foreground">
                  {count > 99 ? "99+" : count}
                </span>
              )
            ) : (
              <>
                <span className="truncate">{label}</span>
                {count > 0 && (
                  <span
                    title={key === "topics" ? "Unresolved topics" : "Unread messages"}
                    className="ml-auto rounded-full bg-sidebar-primary px-1.5 text-[0.62rem] font-semibold text-sidebar-primary-foreground"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** The raw transcript for one category, rendered in the middle column. */
export function RawChatList({ messages, tab }: { messages: ChatMessage[]; tab: ChatTab }) {
  const shown = filterByTab(messages, tab).slice(-200).reverse();
  const label = CHAT_TABS.find((item) => item.key === tab)?.label ?? "Chat";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <p className="text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
        {label} — raw messages
      </p>
      <ul className="mx-auto mt-3 w-full max-w-3xl space-y-2">
        {shown.length === 0 && (
          <li className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
            Nothing here yet.
          </li>
        )}
        {shown.map((message) => {
          const category = CATEGORY_META[toCategory(message.category)];
          return (
            <li
              key={message.id}
              className="rise-in rounded-lg border border-border bg-card px-4 py-3 transition-shadow hover:shadow-panel"
            >
              <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate font-semibold text-foreground">
                  {message.sender_label}
                </span>
                <span className="shrink-0">
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
              <p className="mt-1 text-sm break-words">{message.body}</p>
              <span className="mt-1.5 inline-flex items-center gap-1 text-[0.62rem] text-muted-foreground">
                <span className={`size-1.5 rounded-full ${category.dot}`} />
                {category.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
