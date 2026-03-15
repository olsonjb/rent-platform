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

// Chainable mock builder for Supabase
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

const svcChain: Record<string, ReturnType<typeof vi.fn>> = {};
for (const m of ['select', 'eq', 'is', 'limit', 'update', 'insert', 'upsert'] as const) {
  svcChain[m] = vi.fn().mockReturnValue(svcChain);
}
svcChain.maybeSingle = mockMaybeSingle;

const svcFrom = vi.fn().mockReturnValue(svcChain);

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: svcFrom })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'landlord@test.com',
            user_metadata: { userType: 'landlord' },
          },
        },
      }),
    },
    from: svcFrom,
  })),
}));

import {
  getCurrentOnboardingStep,
  skipStep,
  goToStep,
  completeStep,
} from '@/app/actions/onboarding';

function resetChain() {
  vi.clearAllMocks();
  for (const m of ['select', 'eq', 'is', 'limit', 'update', 'insert', 'upsert'] as const) {
    svcChain[m] = vi.fn().mockReturnValue(svcChain);
  }
  svcChain.maybeSingle = mockMaybeSingle;
  svcFrom.mockReturnValue(svcChain);
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
}

describe('getCurrentOnboardingStep', () => {
  beforeEach(resetChain);

  it('returns the step from the profile', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { onboarding_step: 'add_property' }, error: null });
    const step = await getCurrentOnboardingStep();
    expect(step).toBe('add_property');
  });

  it('returns profile as default when no profile exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const step = await getCurrentOnboardingStep();
    expect(step).toBe('profile');
  });

  it('returns profile for invalid step value', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { onboarding_step: 'bogus' }, error: null });
    const step = await getCurrentOnboardingStep();
    expect(step).toBe('profile');
  });
});

describe('skipStep', () => {
  beforeEach(resetChain);

  it('throws for non-skippable steps', async () => {
    await expect(skipStep('profile')).rejects.toThrow('cannot be skipped');
  });

  it('throws for invalid step', async () => {
    await expect(skipStep('invalid' as never)).rejects.toThrow('Invalid onboarding step');
  });

  it('throws for complete step', async () => {
    await expect(skipStep('complete')).rejects.toThrow('cannot be skipped');
  });
});

describe('goToStep', () => {
  beforeEach(resetChain);

  it('throws for invalid step', async () => {
    await expect(goToStep('invalid' as never)).rejects.toThrow('Invalid onboarding step');
  });

  it('throws when trying to skip ahead', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { onboarding_step: 'profile' }, error: null });
    await expect(goToStep('create_lease')).rejects.toThrow('Cannot skip ahead');
  });
});

describe('completeStep', () => {
  beforeEach(resetChain);

  it('throws for invalid step', async () => {
    await expect(completeStep('invalid' as never)).rejects.toThrow('Invalid onboarding step');
  });

  it('throws when trying to complete the last step', async () => {
    await expect(completeStep('complete')).rejects.toThrow('Already on the last step');
  });
});
