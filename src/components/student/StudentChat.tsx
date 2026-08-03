import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  fetchMessages,
  sendMessage,
  type ChatMessage,
  type LiveClass,
} from "@/lib/student-chat";

type ConnectionState = "connecting" | "live" | "offline";

export function StudentChat({
  liveClass,
  studentName,
}: {
  liveClass: LiveClass;
  studentName: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const feedRef = useRef<HTMLDivElement | null>(null);

  const key = useMemo(() => ["messages", liveClass.id], [liveClass.id]);
  const messagesQuery = useQuery({
    queryKey: key,
    queryFn: () => fetchMessages(liveClass.id),
  });
  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    setConnection("connecting");
    const channel = supabase
      .channel(`chat-${liveClass.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${liveClass.id}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(key, (prev) => {
            const list = prev ?? [];
            if (list.some((m) => m.id === row.id)) return list;
            return [...list, row];
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
          setConnection("offline");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveClass.id, key, queryClient]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      sendMessage({ sessionId: liveClass.id, senderLabel: studentName, body }),
    onError: (error: Error) => toast.error(error.message || "Could not send message"),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim().slice(0, 1000);
    if (!body || sendMutation.isPending) return;
    setDraft("");
    sendMutation.mutate(body);
  };

  const statusMeta: Record<ConnectionState, { label: string; className: string }> = {
    connecting: { label: "Connecting…", className: "text-muted-foreground" },
    live: { label: "Live", className: "text-success" },
    offline: { label: "Reconnecting…", className: "text-destructive" },
  };
  const status = statusMeta[connection];

  return (
    <div className="panel flex h-[70vh] flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="font-display text-sm font-semibold">{liveClass.title}</h2>
          <p className="text-xs text-muted-foreground">Joined as {studentName}</p>
        </div>
        <span className={`inline-flex items-center gap-2 text-xs font-medium ${status.className}`}>
          {connection === "live" && <span className="live-dot" />}
          {status.label}
        </span>
      </header>

      <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messagesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages yet — ask the first question.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_label === studentName && !message.is_teacher;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  <p className="mb-1 text-[0.68rem] tracking-[0.08em] text-muted-foreground uppercase">
                    {message.is_teacher ? `${message.sender_label} · teacher` : message.sender_label}
                  </p>
                  <div
                    className={
                      mine
                        ? "rounded-lg rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "rounded-lg rounded-tl-sm bg-secondary px-3 py-2 text-sm text-foreground"
                    }
                  >
                    {message.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border px-4 py-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          placeholder="Ask a question or share an answer…"
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sendMutation.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
          Send
        </button>
      </form>
    </div>
  );
}
