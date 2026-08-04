/**
 * AI usage accounting. Every Lovable AI Gateway call the app makes is logged so
 * the owner console can chart requests, tokens and credits over time.
 *
 * Credit rates are calibrated against observed Gemini Flash Lite gateway usage
 * (≈0.000549 credits for a 309 in / 40 out merge request).
 */
export const CREDITS_PER_INPUT_TOKEN = 0.0000015;
export const CREDITS_PER_OUTPUT_TOKEN = 0.0000023;

export function creditsFor(inputTokens: number, outputTokens: number): number {
  return inputTokens * CREDITS_PER_INPUT_TOKEN + outputTokens * CREDITS_PER_OUTPUT_TOKEN;
}

type UsageEvent = {
  model: string;
  operation?: string;
  status: "success" | "timeout" | "error";
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  fallback: boolean;
};

/** Fire-and-forget: usage logging must never slow down or break a student send. */
export async function recordAiUsage(event: UsageEvent): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const inputTokens = Math.max(0, Math.round(event.inputTokens ?? 0));
    const outputTokens = Math.max(0, Math.round(event.outputTokens ?? 0));
    await supabaseAdmin.from("ai_usage_events").insert({
      model: event.model,
      operation: event.operation ?? "merge",
      status: event.status,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      duration_ms: Math.max(0, Math.round(event.durationMs)),
      credits: creditsFor(inputTokens, outputTokens),
      fallback: event.fallback,
    });
  } catch (error) {
    console.error("[ai-usage] Could not record usage", error);
  }
}
