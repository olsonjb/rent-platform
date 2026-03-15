export const ONBOARDING_STEPS = [
  'profile',
  'add_property',
  'add_tenant',
  'create_lease',
  'setup_payment',
  'complete',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  profile: 'Profile',
  add_property: 'Add Property',
  add_tenant: 'Add Tenant',
  create_lease: 'Create Lease',
  setup_payment: 'Set Up Payment',
  complete: 'Complete',
};

export interface OnboardingContext {
  hasProfile: boolean;
  hasProperty: boolean;
  hasTenant: boolean;
  hasLease: boolean;
  hasPayment: boolean;
}

export function isStepComplete(
  step: OnboardingStep,
  context: OnboardingContext,
): boolean {
  switch (step) {
    case 'profile':
      return context.hasProfile;
    case 'add_property':
      return context.hasProperty;
    case 'add_tenant':
      return context.hasTenant;
    case 'create_lease':
      return context.hasLease;
    case 'setup_payment':
      return context.hasPayment;
    case 'complete':
      return false;
  }
}

const NON_SKIPPABLE: ReadonlySet<OnboardingStep> = new Set(['profile', 'complete']);

export function canSkipStep(
  step: OnboardingStep,
  _context: OnboardingContext,
): boolean {
  return !NON_SKIPPABLE.has(step);
}

export function getNextStep(currentStep: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(currentStep);
  if (idx === -1 || idx >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[idx + 1];
}

export function getPreviousStep(currentStep: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(currentStep);
  if (idx <= 0) return null;
  return ONBOARDING_STEPS[idx - 1];
}

export function getStepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function isOnboardingComplete(profile: { onboarding_step?: string | null }): boolean {
  return profile.onboarding_step === 'complete';
}

export function isValidStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && ONBOARDING_STEPS.includes(value as OnboardingStep);
}
