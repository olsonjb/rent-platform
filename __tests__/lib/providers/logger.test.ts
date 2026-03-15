import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

import { logProviderSubmission } from '@/lib/providers/logger';

describe('logProviderSubmission', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockInsert.mockClear();
    mockInsert.mockResolvedValue({ error: null });
  });

  it('inserts a log entry into listing_provider_log', async () => {
    logProviderSubmission({
      listing_id: 'abc-123',
      provider: 'Zillow',
      status: 'success',
      response_data: { url: 'https://zillow.com/1' },
    });

    // Let the fire-and-forget promise resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(mockFrom).toHaveBeenCalledWith('listing_provider_log');
    expect(mockInsert).toHaveBeenCalledWith({
      listing_id: 'abc-123',
      provider: 'Zillow',
      status: 'success',
      response_data: { url: 'https://zillow.com/1' },
    });
  });

  it('defaults listing_id to null and response_data to empty object', async () => {
    logProviderSubmission({ provider: 'Webhook', status: 'failed' });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockInsert).toHaveBeenCalledWith({
      listing_id: null,
      provider: 'Webhook',
      status: 'failed',
      response_data: {},
    });
  });

  it('does not throw when insert fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInsert.mockResolvedValue({ error: { message: 'db down' } });

    logProviderSubmission({ provider: 'Test', status: 'pending' });

    await new Promise((r) => setTimeout(r, 10));

    expect(consoleSpy).toHaveBeenCalledWith(
      '[listing-provider-log] insert failed:',
      'db down',
    );
    consoleSpy.mockRestore();
  });

  it('does not throw on unexpected errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInsert.mockRejectedValue(new Error('network crash'));

    logProviderSubmission({ provider: 'Test', status: 'pending' });

    await new Promise((r) => setTimeout(r, 10));

    expect(consoleSpy).toHaveBeenCalledWith(
      '[listing-provider-log] unexpected error:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
