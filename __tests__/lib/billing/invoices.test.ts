import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculatePlatformFee } from '@/lib/billing/invoices';

// Mock supabase service client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockUpsert = vi.fn();
const mockOrder = vi.fn();

const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  upsert: mockUpsert,
});

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

describe('billing/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculatePlatformFee', () => {
    it('calculates 3% of rent amount', () => {
      expect(calculatePlatformFee(100000)).toBe(3000); // $1000 -> $30
    });

    it('rounds to nearest cent', () => {
      expect(calculatePlatformFee(99999)).toBe(3000); // 99999 * 0.03 = 2999.97 -> 3000
    });

    it('handles small amounts', () => {
      expect(calculatePlatformFee(100)).toBe(3); // $1 -> $0.03
    });

    it('handles zero', () => {
      expect(calculatePlatformFee(0)).toBe(0);
    });

    it('handles large amounts', () => {
      expect(calculatePlatformFee(500000)).toBe(15000); // $5000 -> $150
    });

    it('calculates correctly for common rent amounts', () => {
      // $1500/month -> $45 fee
      expect(calculatePlatformFee(150000)).toBe(4500);
      // $2000/month -> $60 fee
      expect(calculatePlatformFee(200000)).toBe(6000);
      // $800/month -> $24 fee
      expect(calculatePlatformFee(80000)).toBe(2400);
    });
  });

  describe('generateMonthlyInvoices', () => {
    it('returns zero counts when no active leases', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { generateMonthlyInvoices } = await import('@/lib/billing/invoices');
      const result = await generateMonthlyInvoices();
      expect(result).toEqual({ created: 0, skipped: 0 });
    });

    it('throws on fetch error', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });

      const { generateMonthlyInvoices } = await import('@/lib/billing/invoices');
      await expect(generateMonthlyInvoices()).rejects.toThrow('Failed to fetch active leases');
    });

    it('creates invoices for active leases', async () => {
      const leases = [
        { id: 'lease-1', landlord_id: 'land-1', tenant_id: 'ten-1', monthly_rent: 1500, property_id: 'prop-1' },
      ];

      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: leases, error: null }),
      });

      mockUpsert.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: 'inv-1' }], error: null }),
      });

      const { generateMonthlyInvoices } = await import('@/lib/billing/invoices');
      const result = await generateMonthlyInvoices();
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('counts skipped when upsert returns empty (duplicate)', async () => {
      const leases = [
        { id: 'lease-1', landlord_id: 'land-1', tenant_id: 'ten-1', monthly_rent: 1500, property_id: 'prop-1' },
      ];

      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: leases, error: null }),
      });

      mockUpsert.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { generateMonthlyInvoices } = await import('@/lib/billing/invoices');
      const result = await generateMonthlyInvoices();
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });
});
