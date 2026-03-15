import { describe, it, expect, afterEach } from 'vitest';
import { getModelConfig } from '@/lib/ai/models';

describe('getModelConfig', () => {
  const envKeys = [
    'AI_MODEL_CHAT',
    'AI_MODEL_SCREENING',
    'AI_MODEL_DECISION',
    'AI_MODEL_CONTENT',
    'AI_MODEL_MAINTENANCE',
  ] as const;

  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it('returns default model for chat service', () => {
    delete process.env.AI_MODEL_CHAT;
    const config = getModelConfig('chat');
    expect(config.model).toBe('claude-sonnet-4-20250514');
    expect(config.maxTokens).toBe(1024);
  });

  it('returns default model for screening service', () => {
    delete process.env.AI_MODEL_SCREENING;
    const config = getModelConfig('screening');
    expect(config.model).toBe('claude-sonnet-4-20250514');
    expect(config.maxTokens).toBe(800);
    expect(config.temperature).toBe(0.2);
  });

  it('returns default model for decision service', () => {
    delete process.env.AI_MODEL_DECISION;
    const config = getModelConfig('decision');
    expect(config.model).toBe('claude-sonnet-4-20250514');
    expect(config.maxTokens).toBe(500);
  });

  it('returns default model for content service', () => {
    delete process.env.AI_MODEL_CONTENT;
    const config = getModelConfig('content');
    expect(config.model).toBe('claude-sonnet-4-20250514');
    expect(config.maxTokens).toBe(1000);
  });

  it('returns default model for maintenance service', () => {
    delete process.env.AI_MODEL_MAINTENANCE;
    const config = getModelConfig('maintenance');
    expect(config.model).toBe('claude-sonnet-4-20250514');
    expect(config.maxTokens).toBe(500);
    expect(config.temperature).toBe(0.2);
  });

  it('overrides model from environment variable', () => {
    saved.AI_MODEL_CHAT = process.env.AI_MODEL_CHAT;
    process.env.AI_MODEL_CHAT = 'claude-haiku-4-5-20251001';
    const config = getModelConfig('chat');
    expect(config.model).toBe('claude-haiku-4-5-20251001');
    // Other config should remain default
    expect(config.maxTokens).toBe(1024);
  });

  it('overrides screening model from environment', () => {
    saved.AI_MODEL_SCREENING = process.env.AI_MODEL_SCREENING;
    process.env.AI_MODEL_SCREENING = 'claude-haiku-4-5-20251001';
    const config = getModelConfig('screening');
    expect(config.model).toBe('claude-haiku-4-5-20251001');
    expect(config.temperature).toBe(0.2);
  });
});
