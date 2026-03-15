import type { AIModelConfig } from './types';

/** Service names that map to AI model configurations. */
export type AIService = 'chat' | 'screening' | 'decision' | 'content' | 'maintenance' | 'renewal' | 'extraction';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/** Default model configs per service. */
const MODEL_DEFAULTS: Record<AIService, AIModelConfig> = {
  chat: { model: DEFAULT_MODEL, maxTokens: 1024 },
  screening: { model: DEFAULT_MODEL, maxTokens: 800, temperature: 0.2 },
  decision: { model: DEFAULT_MODEL, maxTokens: 500 },
  content: { model: DEFAULT_MODEL, maxTokens: 1000 },
  maintenance: { model: DEFAULT_MODEL, maxTokens: 500, temperature: 0.2 },
  renewal: { model: DEFAULT_MODEL, maxTokens: 1000, temperature: 0.3 },
  extraction: { model: DEFAULT_MODEL, maxTokens: 2000, temperature: 0.1 },
};

/** Environment variable names per service for model override. */
const ENV_KEYS: Record<AIService, string> = {
  chat: 'AI_MODEL_CHAT',
  screening: 'AI_MODEL_SCREENING',
  decision: 'AI_MODEL_DECISION',
  content: 'AI_MODEL_CONTENT',
  maintenance: 'AI_MODEL_MAINTENANCE',
  renewal: 'AI_MODEL_RENEWAL',
  extraction: 'AI_MODEL_EXTRACTION',
};

/**
 * Get the model configuration for a given service.
 * Reads `AI_MODEL_<SERVICE>` env var to override the default model.
 */
export function getModelConfig(service: AIService): AIModelConfig {
  const defaults = MODEL_DEFAULTS[service];
  const envModel = process.env[ENV_KEYS[service]];

  if (envModel) {
    return { ...defaults, model: envModel };
  }

  return defaults;
}
