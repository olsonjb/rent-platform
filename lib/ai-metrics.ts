import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ai-metrics");

/** Pricing per million tokens (USD). Update when models change. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-haiku-4-20250414": { input: 0.8, output: 4.0 },
  "claude-haiku-3-5-20241022": { input: 0.8, output: 4.0 },
};

/** Estimate cost in USD for a given model and token count. */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

interface TrackAIUsageParams {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  service: string;
  endpoint?: string;
  correlationId?: string;
  userId?: string;
  promptName?: string;
  promptVersion?: string;
}

/** Fire-and-forget write to the ai_usage_log table. Never throws. */
export async function trackAIUsage(params: TrackAIUsageParams): Promise<void> {
  try {
    const supabase = createServiceClient();
    const cost = estimateCost(params.model, params.inputTokens, params.outputTokens);

    const { error } = await supabase.from("ai_usage_log").insert({
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: params.totalTokens,
      estimated_cost_usd: cost,
      latency_ms: params.latencyMs,
      service: params.service,
      endpoint: params.endpoint ?? null,
      correlation_id: params.correlationId ?? null,
      user_id: params.userId ?? null,
      prompt_name: params.promptName ?? null,
      prompt_version: params.promptVersion ?? null,
    });

    if (error) {
      logger.warn({ error: error.message }, "Failed to write AI usage log");
    }
  } catch (err) {
    logger.warn({ err }, "AI metrics tracking failed silently");
  }
}

interface WithAITrackingParams {
  service: string;
  endpoint?: string;
  correlationId?: string;
  userId?: string;
}

/**
 * Wrap an Anthropic messages.create call. Measures latency, extracts token
 * counts, and writes metrics to ai_usage_log. Returns the Anthropic response.
 */
export async function withAITracking(
  params: WithAITrackingParams,
  fn: () => Promise<Anthropic.Message>,
): Promise<Anthropic.Message> {
  const start = Date.now();
  const response = await fn();
  const latencyMs = Date.now() - start;

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  // Fire-and-forget -- do not await in the caller's hot path
  void trackAIUsage({
    model: response.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    latencyMs,
    service: params.service,
    endpoint: params.endpoint,
    correlationId: params.correlationId,
    userId: params.userId,
  });

  return response;
}
