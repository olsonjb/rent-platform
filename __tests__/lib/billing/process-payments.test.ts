import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chain helpers
function chainMock(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.update = vi.fn().mockReturnValue(chain);
  // Allow terminal awaiting for update chains
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve({ data: null, error: null }));
  return chain;
}

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

const mockPaymentIntentsCreate = vi.fn();

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    paymentIntents: { create: mockPaymentIntentsCreate },
  }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('billing/process-payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zero counts when no pending invoices', async () => {
    const invoiceChain = chainMock({ data: [], error: null });
    // Override: for the invoice fetch path, we need select -> eq -> lte to resolve directly
    invoiceChain.lte = vi.fn().mockResolvedValue({ data: [], error: null });
    invoiceChain.eq = vi.fn().mockReturnValue(invoiceChain);
    invoiceChain.select = vi.fn().mockReturnValue(invoiceChain);

    mockFrom.mockReturnValue(invoiceChain);

    const { processScheduledPayments } = await import('@/lib/billing/process-payments');
    const result = await processScheduledPayments();
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, results: [] });
  });

  it('throws on fetch error', async () => {
    const invoiceChain = chainMock(null);
    invoiceChain.lte = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    invoiceChain.eq = vi.fn().mockReturnValue(invoiceChain);
    invoiceChain.select = vi.fn().mockReturnValue(invoiceChain);

    mockFrom.mockReturnValue(invoiceChain);

    const { processScheduledPayments } = await import('@/lib/billing/process-payments');
    await expect(processScheduledPayments()).rejects.toThrow('Failed to fetch pending invoices');
  });

  it('marks invoice as failed when tenant has no auth user', async () => {
    const invoice = {
      id: 'inv-1',
      tenant_id: 'ten-1',
      amount_cents: 150000,
      platform_fee_cents: 4500,
      lease_id: 'lease-1',
    };

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'rent_invoices' && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [invoice], error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'rent_invoices') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'landlord_tenants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn() }) };
    });

    const { processScheduledPayments } = await import('@/lib/billing/process-payments');
    const result = await processScheduledPayments();
    expect(result.failed).toBe(1);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain('No auth user');
  });

  it('processes payment successfully via Stripe', async () => {
    const invoice = {
      id: 'inv-1',
      tenant_id: 'ten-1',
      amount_cents: 150000,
      platform_fee_cents: 4500,
      lease_id: 'lease-1',
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'rent_invoices') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [invoice], error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'landlord_tenants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { auth_user_id: 'user-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  stripe_customer_id: 'cus_test',
                  stripe_payment_method_id: 'pm_test',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn() }) };
    });

    mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_test_123' });

    const { processScheduledPayments } = await import('@/lib/billing/process-payments');
    const result = await processScheduledPayments();
    expect(result.succeeded).toBe(1);
    expect(result.results[0].paymentIntentId).toBe('pi_test_123');

    // Verify Stripe was called with correct params
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 150000,
        currency: 'usd',
        customer: 'cus_test',
        payment_method: 'pm_test',
        off_session: true,
        confirm: true,
      }),
    );
  });

  it('marks invoice as failed on Stripe error', async () => {
    const invoice = {
      id: 'inv-1',
      tenant_id: 'ten-1',
      amount_cents: 150000,
      platform_fee_cents: 4500,
      lease_id: 'lease-1',
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'rent_invoices') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [invoice], error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'landlord_tenants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { auth_user_id: 'user-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  stripe_customer_id: 'cus_test',
                  stripe_payment_method_id: 'pm_test',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn() }) };
    });

    mockPaymentIntentsCreate.mockRejectedValue(new Error('Card declined'));

    const { processScheduledPayments } = await import('@/lib/billing/process-payments');
    const result = await processScheduledPayments();
    expect(result.failed).toBe(1);
    expect(result.results[0].error).toBe('Card declined');
  });
});
