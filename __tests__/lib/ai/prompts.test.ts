import { describe, it, expect, beforeEach } from 'vitest';
import { createPromptRegistry } from '@/lib/ai/prompts/index';

describe('createPromptRegistry', () => {
  let registry: ReturnType<typeof createPromptRegistry>;

  beforeEach(() => {
    registry = createPromptRegistry();
  });

  describe('register', () => {
    it('registers a prompt template', () => {
      registry.register({
        name: 'test-prompt',
        version: '1.0.0',
        template: 'Hello {{name}}!',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });

      expect(registry.has('test-prompt')).toBe(true);
    });

    it('throws on duplicate name+version', () => {
      const template = {
        name: 'test-prompt',
        version: '1.0.0',
        template: 'Hello {{name}}!',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      };

      registry.register(template);
      expect(() => registry.register(template)).toThrow(
        'Prompt "test-prompt@1.0.0" is already registered',
      );
    });

    it('allows same name with different versions', () => {
      registry.register({
        name: 'test-prompt',
        version: '1.0.0',
        template: 'Hello {{name}} v1!',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });
      registry.register({
        name: 'test-prompt',
        version: '2.0.0',
        template: 'Hello {{name}} v2!',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });

      expect(registry.has('test-prompt')).toBe(true);
    });
  });

  describe('get', () => {
    it('returns a registered prompt by name', () => {
      registry.register({
        name: 'greeting',
        version: '1.0.0',
        template: 'Hi {{name}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });

      const prompt = registry.get('greeting');
      expect(prompt.name).toBe('greeting');
      expect(prompt.version).toBe('1.0.0');
    });

    it('returns specific version when requested', () => {
      registry.register({
        name: 'greeting',
        version: '1.0.0',
        template: 'Hi {{name}} v1',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });
      registry.register({
        name: 'greeting',
        version: '2.0.0',
        template: 'Hi {{name}} v2',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 200,
      });

      const prompt = registry.get('greeting', '1.0.0');
      expect(prompt.version).toBe('1.0.0');
    });

    it('falls back to latest when requested version not found', () => {
      registry.register({
        name: 'greeting',
        version: '1.0.0',
        template: 'Hi {{name}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });

      const prompt = registry.get('greeting', '99.0.0');
      expect(prompt.version).toBe('1.0.0');
    });

    it('throws for unregistered prompt name', () => {
      expect(() => registry.get('nonexistent')).toThrow(
        'Prompt "nonexistent" is not registered',
      );
    });
  });

  describe('render', () => {
    it('renders a string template with variables', () => {
      registry.register({
        name: 'greeting',
        version: '1.0.0',
        template: 'Hello {{name}}, welcome to {{place}}!',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });

      const result = registry.render('greeting', { name: 'Jane', place: 'Utah' });
      expect(result).toBe('Hello Jane, welcome to Utah!');
    });

    it('throws on missing variables', () => {
      registry.register({
        name: 'greeting',
        version: '1.0.0',
        template: 'Hello {{name}}, welcome to {{place}}!',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });

      expect(() => registry.render('greeting', { name: 'Jane' })).toThrow(
        'Missing variables for prompt "greeting": place',
      );
    });

    it('throws listing all missing variables', () => {
      registry.register({
        name: 'greeting',
        version: '1.0.0',
        template: '{{a}} {{b}} {{c}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });

      expect(() => registry.render('greeting', {})).toThrow(
        'Missing variables for prompt "greeting": a, b, c',
      );
    });

    it('renders a function template', () => {
      registry.register({
        name: 'custom',
        version: '1.0.0',
        template: (vars) => `Custom: ${vars.x} + ${vars.y}`,
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });

      const result = registry.render('custom', { x: 'foo', y: 'bar' });
      expect(result).toBe('Custom: foo + bar');
    });

    it('renders a specific version', () => {
      registry.register({
        name: 'greeting',
        version: '1.0.0',
        template: 'v1: {{name}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });
      registry.register({
        name: 'greeting',
        version: '2.0.0',
        template: 'v2: {{name}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });

      expect(registry.render('greeting', { name: 'Jane' }, '1.0.0')).toBe('v1: Jane');
      expect(registry.render('greeting', { name: 'Jane' }, '2.0.0')).toBe('v2: Jane');
    });
  });

  describe('has', () => {
    it('returns false for unregistered prompt', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('returns true for registered prompt', () => {
      registry.register({
        name: 'test',
        version: '1.0.0',
        template: 'test',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 100,
      });
      expect(registry.has('test')).toBe(true);
    });
  });
});
