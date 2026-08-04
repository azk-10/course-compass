import { supabase } from "@/integrations/supabase/client";
import { MESSAGE_FIELDS, type ChatMessage } from "@/lib/live-chat";

/**
 * Adaptive realtime transport for the message feed.
 *
 * Small rooms keep a websocket (instant). Once a session grows past
 * `SOCKET_AUDIENCE_LIMIT` concurrent students — or the socket proves unhealthy —
 * the client downgrades to jittered incremental polling, which costs the
 * realtime service nothing per extra student and is what makes 100k-student
 * sessions viable.
 *
 * Everything arriving from either path goes through one bounded queue that is
 * flushed on an adaptive interval, so a burst of thousands of messages produces
 * a handful of React renders instead of thousands.
 */

export type TransportMode = "socket" | "polling";
export type ConnectionState = "connecting" | "live" | "offline";

export type TransportMetrics = {
  mode: TransportMode;
  /** Rows waiting in the buffer for the next flush. */
  queueDepth: number;
  /** Rows discarded because the buffer overflowed (never silently lost twice). */
  dropped: number;
  /** Current flush interval in ms — grows under pressure. */
  flushMs: number;
  /** Current poll interval in ms (0 while on a socket). */
  pollMs: number;
  /** Rolling messages-per-second arriving from the server. */
  messagesPerSecond: number;
  /** Time between a row's created_at and the client receiving it. */
  lastLatencyMs: number;
  /** Total rows delivered to the UI this session. */
  delivered: number;
};

/** Above this many concurrent students, sockets stop being the cheap option. */
export const SOCKET_AUDIENCE_LIMIT = 300;
/** Hard ceiling on buffered rows before we shed the oldest ones. */
export const MAX_BUFFER = 3000;
/** Rows retained in memory for rendering; older history stays in the database. */
export const MAX_RETAINED = 1500;

const FLUSH_BASE_MS = 180;
const FLUSH_MAX_MS = 1400;

function flushIntervalFor(queueDepth: number): number {
  if (queueDepth > 800) return FLUSH_MAX_MS;
  if (queueDepth > 250) return 700;
  if (queueDepth > 60) return 350;
  return FLUSH_BASE_MS;
}

function pollIntervalFor(audience: number): number {
  if (audience > 20_000) return 5_000;
  if (audience > 5_000) return 3_500;
  if (audience > 1_000) return 2_500;
  return 1_500;
}

/** Spread client polls so 100k tabs never line up on the same tick. */
function jitter(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

export async function fetchMessagesSince(
  sessionId: string,
  cursor: string | null,
  limit = 400,
): Promise<ChatMessage[]> {
  let query = supabase
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (cursor) query = query.gt("created_at", cursor);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export type FeedTransportHandlers = {
  onBatch: (rows: ChatMessage[]) => void;
  onConnection: (state: ConnectionState) => void;
  onMetrics: (metrics: TransportMetrics) => void;
};

export type FeedTransport = {
  /** Feed the transport the live audience size so it can pick a mode. */
  setAudience: (count: number) => void;
  /** Seed the cursor from an initial page load so polling doesn't refetch it. */
  setCursor: (iso: string | null) => void;
  stop: () => void;
};

export function createFeedTransport(
  sessionId: string,
  handlers: FeedTransportHandlers,
): FeedTransport {
  let stopped = false;
  let mode: TransportMode = "socket";
  let audience = 0;
  let cursor: string | null = null;
  let socketFailures = 0;

  let buffer: ChatMessage[] = [];
  let dropped = 0;
  let delivered = 0;
  let flushMs = FLUSH_BASE_MS;
  let pollMs = 0;
  let lastLatencyMs = 0;
  let rateWindow: number[] = [];

  let channel: ReturnType<typeof supabase.channel> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pollBackoff = 0;
  let inFlight = false;

  const emitMetrics = () => {
    const cutoff = Date.now() - 5_000;
    rateWindow = rateWindow.filter((t) => t >= cutoff);
    handlers.onMetrics({
      mode,
      queueDepth: buffer.length,
      dropped,
      flushMs,
      pollMs,
      messagesPerSecond: Math.round((rateWindow.length / 5) * 10) / 10,
      lastLatencyMs,
      delivered,
    });
  };

  const enqueue = (rows: ChatMessage[]) => {
    if (!rows.length) return;
    const now = Date.now();
    for (const row of rows) {
      rateWindow.push(now);
      const created = new Date(row.created_at).getTime();
      if (Number.isFinite(created)) lastLatencyMs = Math.max(0, now - created);
      if (!cursor || row.created_at > cursor) cursor = row.created_at;
    }
    buffer.push(...rows);
    if (buffer.length > MAX_BUFFER) {
      const overflow = buffer.length - MAX_BUFFER;
      buffer = buffer.slice(overflow);
      dropped += overflow;
    }
    scheduleFlush();
  };

  const flush = () => {
    flushTimer = null;
    if (stopped) return;
    if (buffer.length) {
      const batch = buffer;
      buffer = [];
      delivered += batch.length;
      handlers.onBatch(batch);
    }
    emitMetrics();
  };

  const scheduleFlush = () => {
    if (flushTimer || stopped) return;
    flushMs = flushIntervalFor(buffer.length);
    flushTimer = setTimeout(flush, flushMs);
  };

  /* ---------- socket path ---------- */

  const startSocket = () => {
    handlers.onConnection("connecting");
    channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => enqueue([payload.new as ChatMessage]),
      )
      .subscribe((status) => {
        if (stopped) return;
        if (status === "SUBSCRIBED") {
          socketFailures = 0;
          handlers.onConnection("live");
          emitMetrics();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          handlers.onConnection("offline");
          socketFailures += 1;
          // An unhealthy socket is the same problem as an oversized room: fall
          // back to polling rather than hammering reconnects.
          if (socketFailures >= 2) switchTo("polling");
        }
      });
  };

  const stopSocket = () => {
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };

  /* ---------- polling path ---------- */

  const schedulePoll = () => {
    if (stopped || mode !== "polling") return;
    const base = pollBackoff || pollIntervalFor(audience);
    // Background tabs poll far less often — they are not being read.
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    pollMs = jitter(hidden ? base * 4 : base);
    pollTimer = setTimeout(poll, pollMs);
  };

  const poll = async () => {
    pollTimer = null;
    if (stopped || inFlight) return schedulePoll();
    inFlight = true;
    try {
      const rows = await fetchMessagesSince(sessionId, cursor);
      pollBackoff = 0;
      handlers.onConnection("live");
      enqueue(rows);
      emitMetrics();
    } catch {
      handlers.onConnection("offline");
      pollBackoff = Math.min(pollBackoff ? pollBackoff * 2 : 2_000, 20_000);
    } finally {
      inFlight = false;
      schedulePoll();
    }
  };

  const startPolling = () => {
    handlers.onConnection("connecting");
    void poll();
  };

  const stopPolling = () => {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
    pollMs = 0;
  };

  /* ---------- mode switching ---------- */

  function switchTo(next: TransportMode) {
    if (stopped || next === mode) return;
    mode = next;
    if (next === "polling") {
      stopSocket();
      startPolling();
    } else {
      stopPolling();
      socketFailures = 0;
      startSocket();
    }
    emitMetrics();
  }

  const onVisibility = () => {
    if (mode !== "polling") return;
    stopPolling();
    schedulePoll();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  startSocket();

  return {
    setAudience(count: number) {
      audience = count;
      if (mode === "socket" && count > SOCKET_AUDIENCE_LIMIT) switchTo("polling");
      // Only climb back onto a socket when the room is comfortably small again.
      else if (mode === "polling" && socketFailures === 0 && count < SOCKET_AUDIENCE_LIMIT * 0.7)
        switchTo("socket");
    },
    setCursor(iso: string | null) {
      if (iso && (!cursor || iso > cursor)) cursor = iso;
    },
    stop() {
      stopped = true;
      stopSocket();
      stopPolling();
      if (flushTimer) clearTimeout(flushTimer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    },
  };
}

/** Merge a flushed batch into the retained feed, de-duped and capped. */
export function mergeBatch(previous: ChatMessage[], batch: ChatMessage[]): ChatMessage[] {
  if (!batch.length) return previous;
  const seen = new Set(previous.map((m) => m.id));
  const additions = batch.filter((m) => !seen.has(m.id) && seen.add(m.id));
  if (!additions.length) return previous;
  const next = [...previous, ...additions].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
  );
  return next.length > MAX_RETAINED ? next.slice(next.length - MAX_RETAINED) : next;
}
