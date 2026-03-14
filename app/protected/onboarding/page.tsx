import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOnboardingStatus } from '@/app/actions/stripe';
import { getUserRolesFromMetadata } from '@/lib/auth/user-types';
import { PaymentOnboarding } from '@/components/pay-now-button';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = getUserRolesFromMetadata(user.user_metadata);
  if (!roles.includes('landlord')) {
    redirect('/renter/dashboard');
  }

  const onboarding = await getOnboardingStatus();

  // Already authorized or on trial — send to dashboard
  if (
    onboarding?.paymentStatus === 'authorized' ||
    onboarding?.paymentStatus === 'active' ||
    onboarding?.paymentStatus === 'demo_trial'
  ) {
    redirect('/landlord/dashboard');
  }

  const params = await searchParams;
  const justAuthorized = params.status === 'authorized';
  const wasCancelled = params.status === 'cancelled';

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <div className="space-y-2">
        <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900">
          Welcome
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Set Up Billing</h1>
        <p className="text-muted-foreground">
          Auto PM charges a simple 3% fee on your monthly rent collections. No upfront costs —
          you&apos;re only charged when you get paid.
        </p>
      </div>

      {justAuthorized && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Payment method authorized successfully! Redirecting...
          <meta httpEquiv="refresh" content="2;url=/landlord/dashboard" />
        </div>
      )}

      {wasCancelled && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Payment setup was cancelled. You can try again or start a free demo.
        </div>
      )}

      {!justAuthorized && (
        <PaymentOnboarding
          totalMonthlyRentCents={onboarding?.totalMonthlyRentCents ?? 0}
          monthlyFeeCents={onboarding?.monthlyFeeCents ?? 0}
        />
      )}
    </div>
  );
}
