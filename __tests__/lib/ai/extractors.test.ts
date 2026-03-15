import { describe, it, expect } from 'vitest';
import { extractJson } from '@/lib/ai/extractors';

describe('extractJson', () => {
  it('extracts JSON from plain JSON text', () => {
    const result = extractJson('{"key": "value"}', null);
    expect(result).toEqual({ key: 'value' });
  });

  it('extracts JSON from text with surrounding prose', () => {
    const text = 'Here is my analysis:\n\n{"approved": true, "score": 95}\n\nHope this helps!';
    const result = extractJson<{ approved: boolean; score: number }>(text, {
      approved: false,
      score: 0,
    });
    expect(result.approved).toBe(true);
    expect(result.score).toBe(95);
  });

  it('extracts JSON with newlines inside the object', () => {
    const text = `Sure, here's the result:
{
  "title": "Beautiful Home",
  "description": "A lovely place to live.",
  "highlights": ["Pool", "Garden"]
}`;
    const result = extractJson(text, { title: '', description: '', highlights: [] as string[] });
    expect(result.title).toBe('Beautiful Home');
    expect(result.highlights).toHaveLength(2);
  });

  it('returns fallback when no JSON found', () => {
    const fallback = { error: true };
    const result = extractJson('No JSON here at all', fallback);
    expect(result).toEqual(fallback);
  });

  it('returns fallback for empty text', () => {
    const fallback = { default: true };
    const result = extractJson('', fallback);
    expect(result).toEqual(fallback);
  });

  it('returns fallback for invalid JSON', () => {
    const fallback = { valid: false };
    const result = extractJson('{not valid json!!}', fallback);
    expect(result).toEqual(fallback);
  });

  it('returns fallback for text with only braces', () => {
    const fallback = { fallback: true };
    const result = extractJson('{{}', fallback);
    expect(result).toEqual(fallback);
  });

  it('returns fallback when greedy match produces invalid JSON', () => {
    const text = '{"first": true} and {"second": true}';
    // The greedy regex matches from first { to last }, producing invalid JSON
    const result = extractJson(text, null);
    expect(result).toBeNull();
  });

  it('handles nested JSON objects', () => {
    const text = '{"outer": {"inner": "value"}, "array": [1, 2, 3]}';
    const result = extractJson(text, null);
    expect(result).toEqual({ outer: { inner: 'value' }, array: [1, 2, 3] });
  });

  it('uses correct generic type', () => {
    interface TestType {
      name: string;
      count: number;
    }
    const result = extractJson<TestType>('{"name": "test", "count": 42}', {
      name: '',
      count: 0,
    });
    expect(result.name).toBe('test');
    expect(result.count).toBe(42);
  });
});
