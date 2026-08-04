import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchMessages, studentsOnline, type ChatMessage } from "@/lib/live-chat";
import {
  createFeedTransport,
  mergeBatch,
  type ConnectionState,
  type FeedTransport,
  type TransportMetrics,
} from "@/lib/live-transport";

export type { ConnectionState } from "@/lib/live-transport";

const IDLE_METRICS: TransportMetrics = {
  mode: "socket",
  queueDepth: 0,
  dropped: 0,
  flushMs: 0,
  pollMs: 0,
  messagesPerSecond: 0,
  lastLatencyMs: 0,
  delivered: 0,
};

/**
 * Single source of truth for a session's raw message feed.
 *
 * Reads go through an adaptive transport (socket for small rooms, jittered
 * incremental polling for very large ones) with a bounded, coalescing buffer,
 * so the render cost stays flat whether ten or ten thousand students are typing.
 */
export function useLiveMessages(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [metrics, setMetrics] = useState<TransportMetrics>(IDLE_METRICS);
  const transportRef = useRef<FeedTransport | null>(null);
  const key = useMemo(() => ["messages", sessionId], [sessionId]);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchMessages(sessionId!),
    enabled: !!sessionId,
  });

  const applyBatch = useCallback(
    (batch: ChatMessage[]) => {
      queryClient.setQueryData<ChatMessage[]>(key, (prev) => mergeBatch(prev ?? [], batch));
    },
    [queryClient, key],
  );

  useEffect(() => {
    if (!sessionId) return;
    setConnection("connecting");
    setMetrics(IDLE_METRICS);
    const transport = createFeedTransport(sessionId, {
      onBatch: applyBatch,
      onConnection: setConnection,
      onMetrics: setMetrics,
    });
    transportRef.current = transport;
    return () => {
      transport.stop();
      transportRef.current = null;
    };
  }, [sessionId, applyBatch]);

  const messages = query.data ?? [];
  const last = messages.length ? messages[messages.length - 1] : null;
  const audience = useMemo(() => studentsOnline(messages).length, [messages]);

  /* Keep the transport aware of both how far it has read and how big the room is. */
  useEffect(() => {
    if (last) transportRef.current?.setCursor(last.created_at);
  }, [last]);

  useEffect(() => {
    transportRef.current?.setAudience(audience);
  }, [audience]);

  return {
    messages,
    isLoading: query.isLoading,
    connection,
    metrics,
  };
}
