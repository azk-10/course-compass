/**
 * Client-side send limiting. The database enforces the real limit (see the
 * `enforce_message_rate` trigger); this layer exists so a student gets instant,
 * friendly feedback instead of a round-trip and a raw error, and so a runaway
 * client never generates the load in the first place.
 */

export type TokenBucket = {
  /** Consume a token. Returns 0 when allowed, or ms to wait when limited. */
  take: (now?: number) => number;
  /** Ms until the next token, without consuming one. */
  waitMs: (now?: number) => number;
};

/** Burst-tolerant limiter: `capacity` messages, refilling one per `refillMs`. */
export function createTokenBucket(capacity: number, refillMs: number): TokenBucket {
  let tokens = capacity;
  let last = Date.now();

  const refill = (now: number) => {
    const elapsed = now - last;
    if (elapsed <= 0) return;
    const gained = Math.floor(elapsed / refillMs);
    if (gained > 0) {
      tokens = Math.min(capacity, tokens + gained);
      last += gained * refillMs;
    }
  };

  return {
    take(now = Date.now()) {
      refill(now);
      if (tokens > 0) {
        tokens -= 1;
        if (tokens === capacity - 1) last = now;
        return 0;
      }
      return Math.max(1, refillMs - (now - last));
    },
    waitMs(now = Date.now()) {
      refill(now);
      return tokens > 0 ? 0 : Math.max(1, refillMs - (now - last));
    },
  };
}

/** Sliding-window counter matching the database's per-minute cap. */
export function createBurstGuard(limit: number, windowMs: number) {
  let hits: number[] = [];
  return {
    take(now = Date.now()) {
      hits = hits.filter((t) => t > now - windowMs);
      if (hits.length >= limit) return Math.max(1, hits[0]! + windowMs - now);
      hits.push(now);
      return 0;
    },
  };
}

/** Per-student cap the database also enforces. */
export const BURST_LIMIT_PER_MINUTE = 30;

/** Turns the database rate-limit error into something a student understands. */
export function rateLimitMessage(error: unknown): string | null {
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (text.includes("RATE_LIMIT_BURST"))
    return "You've sent a lot of messages — take a short break before sending more.";
  if (text.includes("RATE_LIMIT")) return "Slow down a moment — one message at a time.";
  return null;
}
