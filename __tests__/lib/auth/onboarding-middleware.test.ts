import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

import { shouldRedirectToOnboarding } from '@/lib/auth/onboarding-middleware';

describe('shouldRedirectToOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  it('returns true when no profile exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await shouldRedirectToOnboarding('user-123');
    expect(result).toBe(true);
  });

  it('returns true when onboarding_step is not complete', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { onboarding_step: 'add_property' }, error: null });
    const result = await shouldRedirectToOnboarding('user-123');
    expect(result).toBe(true);
  });

  it('returns false when onboarding_step is complete', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { onboarding_step: 'complete' }, error: null });
    const result = await shouldRedirectToOnboarding('user-123');
    expect(result).toBe(false);
  });

  it('returns true when onboarding_step is profile (default)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { onboarding_step: 'profile' }, error: null });
    const result = await shouldRedirectToOnboarding('user-123');
    expect(result).toBe(true);
  });
});
