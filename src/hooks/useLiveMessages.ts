import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { fetchMessages, type ChatMessage } from "@/lib/live-chat";

export type ConnectionState = "connecting" | "live" | "offline";

/**
 * Single source of truth for a session's raw message feed.
 * Any future grouping layer can consume `messages` without touching storage.
 */
export function useLiveMessages(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const key = useMemo(() => ["messages", sessionId], [sessionId]);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchMessages(sessionId!),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (!sessionId) return;
    setConnection("connecting");
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${sessionId}`,
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
  }, [sessionId, key, queryClient]);

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    connection,
  };
}
