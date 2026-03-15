import { describe, it, expect, vi } from 'vitest';
import { withExponentialBackoff } from '@/lib/ai/retries';

describe('withExponentialBackoff', () => {
  it('returns result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withExponentialBackoff(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 error and succeeds', async () => {
    const error429 = Object.assign(new Error('Rate limited'), { status: 429 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('success');

    const result = await withExponentialBackoff(fn, 3, 1);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 529 error and succeeds', async () => {
    const error529 = Object.assign(new Error('Overloaded'), { status: 529 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error529)
      .mockResolvedValue('success');

    const result = await withExponentialBackoff(fn, 3, 1);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts on retryable errors', async () => {
    const error529 = Object.assign(new Error('Overloaded'), { status: 529 });
    const fn = vi.fn().mockRejectedValue(error529);

    await expect(withExponentialBackoff(fn, 2, 1)).rejects.toThrow('Overloaded');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-retryable error', async () => {
    const error400 = Object.assign(new Error('Bad request'), { status: 400 });
    const fn = vi.fn().mockRejectedValue(error400);

    await expect(withExponentialBackoff(fn, 3, 1)).rejects.toThrow('Bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws immediately on errors without status', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(withExponentialBackoff(fn, 3, 1)).rejects.toThrow('Network error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses default maxAttempts of 3', async () => {
    const error529 = Object.assign(new Error('Overloaded'), { status: 529 });
    const fn = vi.fn().mockRejectedValue(error529);

    await expect(withExponentialBackoff(fn, undefined, 1)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries multiple times before succeeding', async () => {
    const error429 = Object.assign(new Error('Rate limited'), { status: 429 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error429)
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('finally');

    const result = await withExponentialBackoff(fn, 3, 1);
    expect(result).toBe('finally');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
