import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import type { PropertyListing } from '@/lib/providers/types';

vi.mock('@/lib/providers/logger', () => ({
  logProviderSubmission: vi.fn(),
}));

import { webhookProvider, signPayload } from '@/lib/providers/webhook';
import { logProviderSubmission } from '@/lib/providers/logger';

const baseListing: PropertyListing = {
  title: 'Test Unit',
  description: 'A test listing.',
  highlights: ['Test'],
  rent: 1200,
  bedrooms: 1,
  bathrooms: 1,
  sqft: 600,
  address: '789 Pine St',
  city: 'Austin',
  state: 'TX',
  zip: '73301',
};

describe('signPayload', () => {
  it('produces a valid HMAC-SHA256 hex signature', () => {
    const payload = '{"test":true}';
    const secret = 'my-secret';
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    expect(signPayload(payload, secret)).toBe(expected);
  });
});

describe('webhookProvider.submit', () => {
  beforeEach(() => {
    vi.mocked(logProviderSubmission).mockReset();
    vi.restoreAllMocks();
    process.env.WEBHOOK_LISTING_URL = 'https://hooks.example.com/listings';
    process.env.WEBHOOK_LISTING_SECRET = 'test-secret';
  });

  it('returns failure when URL is missing', async () => {
    delete process.env.WEBHOOK_LISTING_URL;

    const result = await webhookProvider.submit(baseListing);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing WEBHOOK_LISTING_URL');
    expect(logProviderSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'Webhook', status: 'failed' }),
    );
  });

  it('sends POST with HMAC signature and returns success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('OK', { status: 200 }),
    );

    const result = await webhookProvider.submit(baseListing);

    expect(result.success).toBe(true);
    expect(result.provider).toBe('Webhook');

    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.example.com/listings');
    expect(opts.method).toBe('POST');

    const headers = opts.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Webhook-Signature']).toBeDefined();

    // Verify HMAC
    const body = opts.body as string;
    const expectedSig = createHmac('sha256', 'test-secret').update(body).digest('hex');
    expect(headers['X-Webhook-Signature']).toBe(expectedSig);

    expect(logProviderSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'Webhook', status: 'success' }),
    );

    fetchSpy.mockRestore();
  });

  it('skips signature when no secret is set', async () => {
    delete process.env.WEBHOOK_LISTING_SECRET;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('OK', { status: 200 }),
    );

    await webhookProvider.submit(baseListing);

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['X-Webhook-Signature']).toBeUndefined();

    fetchSpy.mockRestore();
  });

  it('retries once on non-OK response and returns failure if still failing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500 }),
    );

    const result = await webhookProvider.submit(baseListing);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Webhook returned 500');
    // First attempt + one retry = 2 calls
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    expect(logProviderSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'Webhook', status: 'failed' }),
    );

    fetchSpy.mockRestore();
  });

  it('returns success on retry after first failure', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Error', { status: 503 }))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const result = await webhookProvider.submit(baseListing);

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });

  it('returns failure when fetch throws', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('DNS resolution failed'));

    const result = await webhookProvider.submit(baseListing);

    expect(result.success).toBe(false);
    expect(result.error).toBe('DNS resolution failed');

    fetchSpy.mockRestore();
  });
});
