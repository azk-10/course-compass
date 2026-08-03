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
 * Sidebar navigation for the raw Zoom-style transcript. It only shows the live
 * counts — the actual messages open in the middle column so the teacher reads
 * them where the discussion board normally sits.
 */
export function ChatTabList({
  messages,
  tab,
  onChange,
  threadCount,
}: {
  messages: ChatMessage[];
  tab: ChatTab;
  onChange: (tab: ChatTab) => void;
  threadCount: number;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 pb-4">
      {CHAT_TABS.map(({ key, label, icon: Icon }) => {
        const count = key === "topics" ? threadCount : filterByTab(messages, key).length;
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "opacity-75 hover:bg-sidebar-accent/50 hover:opacity-100"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
            <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 text-[0.62rem]">
              {count}
            </span>
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
            <li key={message.id} className="rounded-lg border border-border bg-card px-4 py-3">
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
