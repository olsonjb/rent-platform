import { describe, it, expect, beforeEach } from 'vitest';
import {
  setMockAnthropicResponse,
  resetAnthropicMock,
  installAnthropicMock,
} from '../../mocks/anthropic';

installAnthropicMock();

import { createAIClient } from '@/lib/ai/client';

describe('createAIClient', () => {
  let client: ReturnType<typeof createAIClient>;

  beforeEach(() => {
    resetAnthropicMock();
    client = createAIClient();
  });

  describe('sendMessage', () => {
    it('sends a message and returns a response', async () => {
      setMockAnthropicResponse('Hello from Claude');

      const response = await client.sendMessage({
        service: 'chat',
        userMessage: 'Hello',
      });

      expect(response.content[0]).toEqual({
        type: 'text',
        text: 'Hello from Claude',
      });
    });

    it('works with system message', async () => {
      setMockAnthropicResponse('Response with system');

      const response = await client.sendMessage({
        service: 'chat',
        userMessage: 'Hello',
        systemMessage: 'You are helpful.',
      });

      expect(client.extractText(response)).toBe('Response with system');
    });
  });

  describe('sendAndExtractJson', () => {
    it('extracts JSON from response', async () => {
      setMockAnthropicResponse(JSON.stringify({ approved: true, score: 95 }));

      const result = await client.sendAndExtractJson(
        { service: 'screening', userMessage: 'Evaluate' },
        { approved: false, score: 0 },
      );

      expect(result).toEqual({ approved: true, score: 95 });
    });

    it('returns fallback on non-JSON response', async () => {
      setMockAnthropicResponse('I cannot help with that');

      const fallback = { error: true };
      const result = await client.sendAndExtractJson(
        { service: 'screening', userMessage: 'Evaluate' },
        fallback,
      );

      expect(result).toEqual(fallback);
    });

    it('extracts JSON from prose response', async () => {
      setMockAnthropicResponse('Here is my analysis:\n\n{"result": "pass"}\n\nDone.');

      const result = await client.sendAndExtractJson(
        { service: 'decision', userMessage: 'Decide' },
        { result: 'fail' },
      );

      expect(result).toEqual({ result: 'pass' });
    });
  });

  describe('extractText', () => {
    it('extracts text from response with text block', async () => {
      setMockAnthropicResponse('Test text');
      const response = await client.sendMessage({
        service: 'chat',
        userMessage: 'Hello',
      });
      expect(client.extractText(response)).toBe('Test text');
    });
  });
});
