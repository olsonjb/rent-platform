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

/** Create property without redirecting — for use in onboarding wizard. */
export async function onboardingCreateProperty(formData: FormData): Promise<{ error?: string }> {
  const { validateCreateProperty } = await import('@/lib/validation');
  const { user, supabase } = await getAuthenticatedLandlord();

  const validation = validateCreateProperty(formData);
  if (!validation.valid) {
    return { error: Object.values(validation.errors)[0] };
  }

  const { error } = await supabase.from('properties').insert({
    landlord_id: user.id,
    name: formData.get('name') as string,
    address: formData.get('address') as string,
    city: formData.get('city') as string,
    state: formData.get('state') as string,
    zip: formData.get('zip') as string,
    bedrooms: parseInt(formData.get('bedrooms') as string, 10),
    bathrooms: parseFloat(formData.get('bathrooms') as string),
    monthly_rent: parseFloat(formData.get('monthly_rent') as string),
    rent_due_day: parseInt(formData.get('rent_due_day') as string, 10) || 1,
  });

  if (error) return { error: error.message };
  return {};
}

/** Create tenant without redirecting — for use in onboarding wizard. */
export async function onboardingCreateTenant(formData: FormData): Promise<{ error?: string }> {
  const { validateCreateTenant } = await import('@/lib/validation');
  const { user, supabase } = await getAuthenticatedLandlord();

  const validation = validateCreateTenant(formData);
  if (!validation.valid) {
    return { error: Object.values(validation.errors)[0] };
  }

  const { error } = await supabase.from('landlord_tenants').insert({
    landlord_id: user.id,
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: (formData.get('phone') as string) || null,
  });

  if (error) return { error: error.message };
  return {};
}

/** Create lease without redirecting — for use in onboarding wizard. */
export async function onboardingCreateLease(formData: FormData): Promise<{ error?: string }> {
  const { validateCreateLease } = await import('@/lib/validation');
  const { user, supabase } = await getAuthenticatedLandlord();

  const validation = validateCreateLease(formData);
  if (!validation.valid) {
    return { error: Object.values(validation.errors)[0] };
  }

  const { error } = await supabase.from('leases').insert({
    landlord_id: user.id,
    property_id: formData.get('property_id') as string,
    tenant_id: formData.get('tenant_id') as string,
    start_date: formData.get('start_date') as string,
    end_date: formData.get('end_date') as string,
    monthly_rent: parseFloat(formData.get('monthly_rent') as string),
    status: formData.get('status') as string,
  });

  if (error) return { error: error.message };
  return {};
}

/** Save profile info (name, phone) during onboarding. */
export async function onboardingSaveProfile(formData: FormData): Promise<{ error?: string }> {
  const { user } = await getAuthenticatedLandlord();
  const svc = createServiceClient();

  const fullName = (formData.get('full_name') as string)?.trim();
  if (!fullName) {
    return { error: 'Full name is required' };
  }

  const { error } = await svc
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email,
        full_name: fullName,
        phone: (formData.get('phone') as string)?.trim() || null,
      },
      { onConflict: 'id' },
    );

  if (error) return { error: error.message };
  return {};
}
