/** A registered prompt template with versioning and model config. */
export interface PromptTemplate {
  /** Unique identifier for this prompt. */
  name: string;
  /** Semver version string (e.g. "1.0.0"). */
  version: string;
  /** Template string with {{variable}} placeholders, or a render function. */
  template: string | ((variables: Record<string, string>) => string);
  /** Claude model to use for this prompt. */
  model: string;
  /** Maximum tokens for the response. */
  maxTokens: number;
  /** Temperature for the response (0-1). */
  temperature?: number;
}

/** Centralized model configuration for a service. */
export interface AIModelConfig {
  model: string;
  maxTokens: number;
  temperature?: number;
}

/** Metadata logged with each AI call. */
export interface AICallMetadata {
  service: string;
  endpoint?: string;
  correlationId?: string;
  userId?: string;
  promptName?: string;
  promptVersion?: string;
}
