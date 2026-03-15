'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getUserRolesFromMetadata } from '@/lib/auth/user-types';
import {
  type OnboardingStep,
  type OnboardingContext,
  isValidStep,
  isStepComplete,
  getNextStep,
  canSkipStep,
  ONBOARDING_STEPS,
} from '@/lib/onboarding/state';

async function getAuthenticatedLandlord() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const roles = getUserRolesFromMetadata(user.user_metadata);
  if (!roles.includes('landlord')) {
    throw new Error('Only landlords can access onboarding');
  }

  return { user, supabase };
}

export async function getOnboardingContext(): Promise<OnboardingContext> {
  const { user } = await getAuthenticatedLandlord();
  const svc = createServiceClient();

  const [profileResult, propertiesResult, tenantsResult, leasesResult, paymentResult] =
    await Promise.all([
      svc.from('profiles').select('id').eq('id', user.id).maybeSingle(),
      svc.from('properties').select('id').eq('landlord_id', user.id).limit(1),
      svc.from('landlord_tenants').select('id').eq('landlord_id', user.id).limit(1),
      svc.from('leases').select('id').eq('landlord_id', user.id).limit(1),
      svc
        .from('profiles')
        .select('payment_status')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

  const paymentStatus = paymentResult.data?.payment_status ?? 'none';

  return {
    hasProfile: !!profileResult.data,
    hasProperty: (propertiesResult.data?.length ?? 0) > 0,
    hasTenant: (tenantsResult.data?.length ?? 0) > 0,
    hasLease: (leasesResult.data?.length ?? 0) > 0,
    hasPayment: paymentStatus === 'authorized' || paymentStatus === 'active' || paymentStatus === 'demo_trial',
  };
}

export async function getCurrentOnboardingStep(): Promise<OnboardingStep> {
  const { user } = await getAuthenticatedLandlord();
  const svc = createServiceClient();

  const { data: profile } = await svc
    .from('profiles')
    .select('onboarding_step')
    .eq('id', user.id)
    .maybeSingle();

  const step = profile?.onboarding_step;
  if (step && isValidStep(step)) return step;
  return 'profile';
}

export async function completeStep(step: OnboardingStep): Promise<OnboardingStep> {
  if (!isValidStep(step)) {
    throw new Error(`Invalid onboarding step: ${step}`);
  }

  const { user } = await getAuthenticatedLandlord();
  const svc = createServiceClient();
  const context = await getOnboardingContext();

  if (!isStepComplete(step, context) && step !== 'complete') {
    throw new Error(`Step "${step}" is not yet complete`);
  }

  const next = getNextStep(step);
  if (!next) {
    throw new Error('Already on the last step');
  }

  // Auto-advance through already-completed steps
  let target: OnboardingStep = next;
  const ctx = await getOnboardingContext();
  while (target !== 'complete' && isStepComplete(target, ctx)) {
    const after = getNextStep(target);
    if (!after) break;
    target = after;
  }

  await svc
    .from('profiles')
    .update({ onboarding_step: target })
    .eq('id', user.id);

  return target;
}

export async function skipStep(step: OnboardingStep): Promise<OnboardingStep> {
  if (!isValidStep(step)) {
    throw new Error(`Invalid onboarding step: ${step}`);
  }

  const context = await getOnboardingContext();
  if (!canSkipStep(step, context)) {
    throw new Error(`Step "${step}" cannot be skipped`);
  }

  const { user } = await getAuthenticatedLandlord();
  const svc = createServiceClient();

  const next = getNextStep(step);
  if (!next) {
    throw new Error('Cannot skip the last step');
  }

  await svc
    .from('profiles')
    .update({ onboarding_step: next })
    .eq('id', user.id);

  return next;
}

export async function goToStep(step: OnboardingStep): Promise<void> {
  if (!isValidStep(step)) {
    throw new Error(`Invalid onboarding step: ${step}`);
  }

  const { user } = await getAuthenticatedLandlord();
  const svc = createServiceClient();

  // Can only go back to previous or current steps
  const currentStep = await getCurrentOnboardingStep();
  const currentIdx = ONBOARDING_STEPS.indexOf(currentStep);
  const targetIdx = ONBOARDING_STEPS.indexOf(step);

  if (targetIdx > currentIdx) {
    throw new Error('Cannot skip ahead in onboarding');
  }

  await svc
    .from('profiles')
    .update({ onboarding_step: step })
    .eq('id', user.id);
}
