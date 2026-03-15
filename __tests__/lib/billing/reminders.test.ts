import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSingle = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('billing/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty array when no upcoming payments', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const { getUpcomingPayments } = await import('@/lib/billing/reminders');
    const result = await getUpcomingPayments(7);
    expect(result).toEqual([]);
  });

  it('throws on fetch error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    });

    const { getUpcomingPayments } = await import('@/lib/billing/reminders');
    await expect(getUpcomingPayments(7)).rejects.toThrow('Failed to fetch upcoming payments');
  });

  it('returns upcoming payments with tenant and property info', async () => {
    const invoices = [
      { id: 'inv-1', tenant_id: 'ten-1', amount_cents: 150000, due_date: '2026-04-01', lease_id: 'lease-1' },
    ];

    let callIdx = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'rent_invoices') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({ data: invoices, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'landlord_tenants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Jane Doe', email: 'jane@test.com', phone: '+15551234567' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'leases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { property_id: 'prop-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { address: '123 Main St' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { getUpcomingPayments } = await import('@/lib/billing/reminders');
    const result = await getUpcomingPayments(7);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      invoiceId: 'inv-1',
      tenantId: 'ten-1',
      tenantName: 'Jane Doe',
      tenantEmail: 'jane@test.com',
      tenantPhone: '+15551234567',
      amountCents: 150000,
      dueDate: '2026-04-01',
      propertyAddress: '123 Main St',
    });
  });
});
