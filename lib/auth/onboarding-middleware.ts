import { createServiceClient } from '@/lib/supabase/service';

/**
 * Check if a landlord should be redirected to the onboarding wizard.
 * Returns true if onboarding is incomplete.
 */
export async function shouldRedirectToOnboarding(userId: string): Promise<boolean> {
  const svc = createServiceClient();

  const { data: profile } = await svc
    .from('profiles')
    .select('onboarding_step')
    .eq('id', userId)
    .maybeSingle();

  // No profile row or step isn't 'complete' means onboarding is needed
  if (!profile) return true;
  return profile.onboarding_step !== 'complete';
}
