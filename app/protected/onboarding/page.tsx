import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserRolesFromMetadata } from '@/lib/auth/user-types';
import {
  getCurrentOnboardingStep,
  getOnboardingContext,
} from '@/app/actions/onboarding';
import { getOnboardingStatus } from '@/app/actions/stripe';
import { getProperties } from '@/app/actions/properties';
import { getTenants } from '@/app/actions/tenants';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { createServiceClient } from '@/lib/supabase/service';

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OnboardingContent({
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

  // Renter onboarding: show waiting message
  if (!roles.includes('landlord')) {
    return <RenterOnboarding userId={user.id} email={user.email ?? ''} />;
  }

  const params = await searchParams;

  // If returning from Stripe with authorized status, show success message
  if (params.status === 'authorized') {
    return (
      <div className="mx-auto max-w-lg space-y-8 py-8">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Payment method authorized successfully! Redirecting...
          <meta httpEquiv="refresh" content="2;url=/landlord/dashboard" />
        </div>
      </div>
    );
  }

  const [currentStep, context, paymentInfo, properties, tenants] = await Promise.all([
    getCurrentOnboardingStep(),
    getOnboardingContext(),
    getOnboardingStatus(),
    getProperties(),
    getTenants(),
  ]);

  // Already complete — go to dashboard
  if (currentStep === 'complete') {
    redirect('/landlord/dashboard');
  }

  return (
    <OnboardingWizard
      initialStep={currentStep}
      context={context}
      email={user.email ?? ''}
      properties={properties}
      tenants={tenants}
      totalMonthlyRentCents={paymentInfo?.totalMonthlyRentCents ?? 0}
      monthlyFeeCents={paymentInfo?.monthlyFeeCents ?? 0}
    />
  );
}

async function RenterOnboarding({ userId, email }: { userId: string; email: string }) {
  const svc = createServiceClient();

  const { data: tenant } = await svc
    .from('tenants')
    .select('property_id')
    .eq('id', userId)
    .maybeSingle();

  if (tenant?.property_id) {
    redirect('/renter/dashboard');
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-16 text-center">
      <div className="inline-flex rounded-full bg-blue-100 p-4">
        <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold">Waiting for your landlord</h1>
      <p className="text-muted-foreground">
        Your landlord hasn&apos;t added you to a property yet.
        Once they link your account, you&apos;ll be redirected to your dashboard.
      </p>
      <p className="text-sm text-muted-foreground">
        Your account email: <span className="font-medium text-foreground">{email}</span>
      </p>
    </div>
  );
}

function OnboardingFallback() {
  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <div className="space-y-2">
        <div className="h-6 w-20 animate-pulse rounded-full bg-emerald-100" />
        <div className="h-9 w-56 animate-pulse rounded bg-zinc-200" />
        <div className="h-5 w-full animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="h-56 animate-pulse rounded-xl border border-zinc-900/10 bg-white" />
    </div>
  );
}
