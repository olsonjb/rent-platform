import Anthropic from '@anthropic-ai/sdk';
import { withAITracking } from '@/lib/ai-metrics';
import { getModelConfig, type AIService } from './models';
import { extractJson } from './extractors';
import { withExponentialBackoff } from './retries';
import type { AICallMetadata } from './types';

export interface AIClientOptions {
  apiKey?: string;
}

export interface SendMessageOptions {
  service: AIService;
  userMessage: string;
  systemMessage?: string;
  messages?: Anthropic.MessageParam[];
  metadata?: Omit<AICallMetadata, 'service'>;
}

export interface AIClient {
  /**
   * Send a message to Claude using centralized model config, retries, and tracking.
   * Returns the raw Anthropic response.
   */
  sendMessage(options: SendMessageOptions): Promise<Anthropic.Message>;

  /**
   * Send a message and extract JSON from the response.
   * Returns the parsed JSON or the fallback value.
   */
  sendAndExtractJson<T>(options: SendMessageOptions, fallback: T): Promise<T>;

  /**
   * Extract the text content from an Anthropic response.
   */
  extractText(response: Anthropic.Message): string;
}

/**
 * Create an AIClient that wraps the Anthropic SDK with:
 * - Centralized model config from getModelConfig()
 * - Automatic retry with exponential backoff on 429/529
 * - AI usage tracking via withAITracking()
 * - JSON extraction utility
 */
export function createAIClient(options?: AIClientOptions): AIClient {
  const anthropic = options?.apiKey
    ? new Anthropic({ apiKey: options.apiKey })
    : new Anthropic();

  function extractText(response: Anthropic.Message): string {
    const textBlock = response.content.find(
      (block) => block.type === 'text',
    );
    return textBlock && textBlock.type === 'text' ? textBlock.text : '';
  }

  async function sendMessage(opts: SendMessageOptions): Promise<Anthropic.Message> {
    const modelConfig = getModelConfig(opts.service);

    const trackingParams = {
      service: opts.service,
      endpoint: opts.metadata?.endpoint,
      correlationId: opts.metadata?.correlationId,
      userId: opts.metadata?.userId,
    };

    const messages: Anthropic.MessageParam[] = opts.messages
      ? opts.messages
      : [{ role: 'user' as const, content: opts.userMessage }];

    return withExponentialBackoff(() =>
      withAITracking(trackingParams, () =>
        anthropic.messages.create({
          model: modelConfig.model,
          max_tokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
          ...(opts.systemMessage ? { system: opts.systemMessage } : {}),
          messages,
        }),
      ),
    );
  }

  async function sendAndExtractJson<T>(
    opts: SendMessageOptions,
    fallback: T,
  ): Promise<T> {
    const response = await sendMessage(opts);
    const text = extractText(response);
    return extractJson(text, fallback);
  }

  return { sendMessage, sendAndExtractJson, extractText };
}
