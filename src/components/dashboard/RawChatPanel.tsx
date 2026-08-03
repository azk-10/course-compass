import { useState } from "react";
import { HelpCircle, MessageSquare, Coffee, ShieldAlert, Wrench } from "lucide-react";

import { CATEGORY_META, toCategory, type Category } from "@/lib/classify";
import type { ChatMessage } from "@/lib/live-chat";

type Tab = "all" | Category;

const TABS: { key: Tab; label: string; icon: typeof MessageSquare }[] = [
  { key: "all", label: "All chat", icon: MessageSquare },
  { key: "question", label: "Questions", icon: HelpCircle },
  { key: "technical", label: "Technical", icon: Wrench },
  { key: "general", label: "Off-topic", icon: Coffee },
  { key: "spam", label: "Spam", icon: ShieldAlert },
];

/**
 * The raw Zoom-style transcript. The teacher never needs it to run the class,
 * but it is the place to read exactly what a student wrote — split by category
 * so spam, technical problems and off-topic chatter each have their own tab.
 */
export function RawChatPanel({ messages }: { messages: ChatMessage[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const students = messages.filter((message) => !message.is_teacher);
  const countFor = (key: Tab) =>
    key === "all"
      ? students.length
      : students.filter((message) => toCategory(message.category) === key).length;
  const shown = (
    tab === "all"
      ? students
      : students.filter((message) => toCategory(message.category) === tab)
  )
    .slice(-200)
    .reverse();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <TabButton key={key} active={tab === key} onClick={() => setTab(key)}>
            <Icon className="size-3.5 shrink-0" /> {label}
            <Count value={countFor(key)} />
          </TabButton>
        ))}
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        {shown.length === 0 && (
          <li className="px-2 py-4 text-xs opacity-60">
            {tab === "all" ? "No messages yet." : "Nothing in this category yet."}
          </li>
        )}
        {shown.map((message) => {
          const category = CATEGORY_META[toCategory(message.category)];
          return (
            <li key={message.id} className="rounded-lg bg-sidebar-accent/50 px-3 py-2">
              <p className="flex items-center justify-between gap-2 text-[0.68rem] opacity-70">
                <span className="truncate font-semibold">{message.sender_label}</span>
                <span className="shrink-0">
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
              <p className="mt-0.5 text-sm break-words">{message.body}</p>
              <span className="mt-1 inline-flex items-center gap-1 text-[0.62rem] opacity-60">
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "opacity-70 hover:opacity-100"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  return <span className="rounded-full bg-sidebar-accent px-1.5 text-[0.62rem]">{value}</span>;
}
