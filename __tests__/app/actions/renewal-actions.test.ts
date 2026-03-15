import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock renewal content generator
const mockGenerateOffer = vi.fn().mockResolvedValue('Dear Tenant, your renewal offer...');
vi.mock('@/lib/agent/renewal-content', () => ({
  generateRenewalOffer: (...args: unknown[]) => mockGenerateOffer(...args),
}));

// Chainable Supabase mock
const queryResult = { data: null as unknown, error: null as unknown };

const builder: Record<string, ReturnType<typeof vi.fn>> = {};
const chainMethods = [
  'from', 'select', 'insert', 'update', 'delete',
  'eq', 'neq', 'in', 'order', 'limit',
];
for (const method of chainMethods) {
  builder[method] = vi.fn().mockReturnValue(builder);
}
builder.single = vi.fn().mockImplementation(() => Promise.resolve(queryResult));

Object.defineProperty(builder, 'then', {
  value: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve(queryResult),
  writable: true,
  configurable: true,
});

const mockFrom = vi.fn().mockReturnValue(builder);

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'landlord-1',
            email: 'landlord@test.com',
            user_metadata: { userType: 'landlord' },
          },
        },
      }),
    },
    from: mockFrom,
  })),
}));

import {
  getPendingRenewals,
  approveRenewal,
  declineRenewal,
} from '@/app/actions/renewal-actions';

const fakeOffer = {
  id: 'offer-1',
  lease_id: 'lease-1',
  tenant_id: 'tenant-1',
  landlord_id: 'landlord-1',
  new_monthly_rent: 1300,
  new_end_date: '2027-03-15',
  offer_letter: null,
  status: 'pending',
  ai_recommendation: 'renew-adjust',
  ai_reasoning: 'Good tenant',
  suggested_rent_adjustment: 100,
  sent_at: null,
  responded_at: null,
  expires_at: null,
  created_at: '2026-03-15',
  updated_at: '2026-03-15',
  leases: {
    monthly_rent: 1200,
    start_date: '2025-03-15',
    end_date: '2026-03-15',
    property_id: 'prop-1',
    properties: {
      address: '123 Main St',
      city: 'SLC',
      state: 'UT',
    },
  },
  landlord_tenants: {
    name: 'Tenant One',
    email: 'tenant@example.com',
  },
};

function resetMocks() {
  vi.clearAllMocks();
  mockGenerateOffer.mockResolvedValue('Dear Tenant, your renewal offer...');
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(queryResult));
  mockFrom.mockReturnValue(builder);
}

describe('renewal-actions', () => {
  beforeEach(resetMocks);

  describe('getPendingRenewals', () => {
    it('returns pending renewals for the landlord', async () => {
      queryResult.data = [fakeOffer];
      queryResult.error = null;

      const result = await getPendingRenewals();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('offer-1');
    });

    it('returns empty array when no pending renewals', async () => {
      queryResult.data = [];
      queryResult.error = null;

      const result = await getPendingRenewals();
      expect(result).toHaveLength(0);
    });
  });

  describe('approveRenewal', () => {
    it('generates offer letter and updates offer', async () => {
      // single() for fetch returns the offer
      builder.single = vi.fn().mockResolvedValue({
        data: fakeOffer,
        error: null,
      });

      // update() returns success
      queryResult.data = null;
      queryResult.error = null;

      await approveRenewal('offer-1');

      expect(mockGenerateOffer).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('renewal_offers');
    });

    it('uses modified rent when provided', async () => {
      builder.single = vi.fn().mockResolvedValue({
        data: fakeOffer,
        error: null,
      });
      queryResult.data = null;
      queryResult.error = null;

      await approveRenewal('offer-1', 1400);

      const callArgs = mockGenerateOffer.mock.calls[0][0];
      expect(callArgs.newRent).toBe(1400);
    });

    it('throws when offer not found', async () => {
      builder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(approveRenewal('nonexistent')).rejects.toThrow('Renewal offer not found');
    });
  });

  describe('declineRenewal', () => {
    it('marks offer as declined and updates lease', async () => {
      builder.single = vi.fn().mockResolvedValue({
        data: { lease_id: 'lease-1' },
        error: null,
      });
      queryResult.data = null;
      queryResult.error = null;

      await declineRenewal('offer-1');

      expect(mockFrom).toHaveBeenCalledWith('renewal_offers');
      expect(mockFrom).toHaveBeenCalledWith('leases');
    });

    it('throws when offer not found', async () => {
      builder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(declineRenewal('nonexistent')).rejects.toThrow('Renewal offer not found');
    });
  });
});
