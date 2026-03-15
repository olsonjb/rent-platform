import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  isStepComplete,
  canSkipStep,
  getNextStep,
  getPreviousStep,
  getStepIndex,
  isOnboardingComplete,
  isValidStep,
  type OnboardingContext,
} from '@/lib/onboarding/state';

const fullContext: OnboardingContext = {
  hasProfile: true,
  hasProperty: true,
  hasTenant: true,
  hasLease: true,
  hasPayment: true,
};

const emptyContext: OnboardingContext = {
  hasProfile: false,
  hasProperty: false,
  hasTenant: false,
  hasLease: false,
  hasPayment: false,
};

describe('ONBOARDING_STEPS', () => {
  it('has 6 steps in the correct order', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'profile',
      'add_property',
      'add_tenant',
      'create_lease',
      'setup_payment',
      'complete',
    ]);
  });
});

describe('isValidStep', () => {
  it('returns true for valid step names', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(isValidStep(step)).toBe(true);
    }
  });

  it('returns false for invalid values', () => {
    expect(isValidStep('invalid')).toBe(false);
    expect(isValidStep('')).toBe(false);
    expect(isValidStep(null)).toBe(false);
    expect(isValidStep(42)).toBe(false);
    expect(isValidStep(undefined)).toBe(false);
  });
});

describe('isStepComplete', () => {
  it('returns true when profile exists', () => {
    expect(isStepComplete('profile', fullContext)).toBe(true);
  });

  it('returns false when profile missing', () => {
    expect(isStepComplete('profile', emptyContext)).toBe(false);
  });

  it('returns true when property exists', () => {
    expect(isStepComplete('add_property', fullContext)).toBe(true);
  });

  it('returns false when no property', () => {
    expect(isStepComplete('add_property', emptyContext)).toBe(false);
  });

  it('returns true when tenant exists', () => {
    expect(isStepComplete('add_tenant', fullContext)).toBe(true);
  });

  it('returns false when no tenant', () => {
    expect(isStepComplete('add_tenant', emptyContext)).toBe(false);
  });

  it('returns true when lease exists', () => {
    expect(isStepComplete('create_lease', fullContext)).toBe(true);
  });

  it('returns false when no lease', () => {
    expect(isStepComplete('create_lease', emptyContext)).toBe(false);
  });

  it('returns true when payment exists', () => {
    expect(isStepComplete('setup_payment', fullContext)).toBe(true);
  });

  it('returns false when no payment', () => {
    expect(isStepComplete('setup_payment', emptyContext)).toBe(false);
  });

  it('returns false for complete step (never auto-completes)', () => {
    expect(isStepComplete('complete', fullContext)).toBe(false);
  });
});

describe('canSkipStep', () => {
  it('cannot skip profile step', () => {
    expect(canSkipStep('profile', emptyContext)).toBe(false);
  });

  it('cannot skip complete step', () => {
    expect(canSkipStep('complete', emptyContext)).toBe(false);
  });

  it('can skip add_property', () => {
    expect(canSkipStep('add_property', emptyContext)).toBe(true);
  });

  it('can skip add_tenant', () => {
    expect(canSkipStep('add_tenant', emptyContext)).toBe(true);
  });

  it('can skip create_lease', () => {
    expect(canSkipStep('create_lease', emptyContext)).toBe(true);
  });

  it('can skip setup_payment', () => {
    expect(canSkipStep('setup_payment', emptyContext)).toBe(true);
  });
});

describe('getNextStep', () => {
  it('returns add_property after profile', () => {
    expect(getNextStep('profile')).toBe('add_property');
  });

  it('returns add_tenant after add_property', () => {
    expect(getNextStep('add_property')).toBe('add_tenant');
  });

  it('returns create_lease after add_tenant', () => {
    expect(getNextStep('add_tenant')).toBe('create_lease');
  });

  it('returns setup_payment after create_lease', () => {
    expect(getNextStep('create_lease')).toBe('setup_payment');
  });

  it('returns complete after setup_payment', () => {
    expect(getNextStep('setup_payment')).toBe('complete');
  });

  it('returns null for complete (last step)', () => {
    expect(getNextStep('complete')).toBeNull();
  });
});

describe('getPreviousStep', () => {
  it('returns null for profile (first step)', () => {
    expect(getPreviousStep('profile')).toBeNull();
  });

  it('returns profile for add_property', () => {
    expect(getPreviousStep('add_property')).toBe('profile');
  });

  it('returns setup_payment for complete', () => {
    expect(getPreviousStep('complete')).toBe('setup_payment');
  });
});

describe('getStepIndex', () => {
  it('returns correct index for each step', () => {
    expect(getStepIndex('profile')).toBe(0);
    expect(getStepIndex('add_property')).toBe(1);
    expect(getStepIndex('add_tenant')).toBe(2);
    expect(getStepIndex('create_lease')).toBe(3);
    expect(getStepIndex('setup_payment')).toBe(4);
    expect(getStepIndex('complete')).toBe(5);
  });
});

describe('isOnboardingComplete', () => {
  it('returns true when onboarding_step is complete', () => {
    expect(isOnboardingComplete({ onboarding_step: 'complete' })).toBe(true);
  });

  it('returns false when on a different step', () => {
    expect(isOnboardingComplete({ onboarding_step: 'profile' })).toBe(false);
    expect(isOnboardingComplete({ onboarding_step: 'add_property' })).toBe(false);
  });

  it('returns false when onboarding_step is null/undefined', () => {
    expect(isOnboardingComplete({ onboarding_step: null })).toBe(false);
    expect(isOnboardingComplete({})).toBe(false);
  });
});
