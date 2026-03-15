'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  type OnboardingStep,
  ONBOARDING_STEPS,
  STEP_LABELS,
  getStepIndex,
} from '@/lib/onboarding/state';
import type { OnboardingContext } from '@/lib/onboarding/state';
import type { Property, LandlordTenant } from '@/lib/types';
import { ProfileStep } from './ProfileStep';
import { PropertyStep } from './PropertyStep';
import { TenantStep } from './TenantStep';
import { LeaseStep } from './LeaseStep';
import { PaymentStep } from './PaymentStep';
import { CompleteStep } from './CompleteStep';

interface OnboardingWizardProps {
  initialStep: OnboardingStep;
  context: OnboardingContext;
  email: string;
  properties: Property[];
  tenants: LandlordTenant[];
  totalMonthlyRentCents: number;
  monthlyFeeCents: number;
}

const VISIBLE_STEPS = ONBOARDING_STEPS.filter((s) => s !== 'complete');

export function OnboardingWizard({
  initialStep,
  context,
  email,
  properties,
  tenants,
  totalMonthlyRentCents,
  monthlyFeeCents,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
  const router = useRouter();

  const advance = useCallback(() => {
    router.refresh();
    const idx = getStepIndex(currentStep);
    const next = ONBOARDING_STEPS[idx + 1];
    if (next) {
      setCurrentStep(next);
    }
  }, [currentStep, router]);

  const goBack = useCallback(() => {
    const idx = getStepIndex(currentStep);
    if (idx > 0) {
      const prev = ONBOARDING_STEPS[idx - 1];
      import('@/app/actions/onboarding').then(({ goToStep }) => {
        goToStep(prev).then(() => setCurrentStep(prev));
      });
    }
  }, [currentStep]);

  const currentIdx = getStepIndex(currentStep);

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 py-8">
      {/* Progress indicator */}
      <div className="space-y-2">
        <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900">
          Welcome
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {currentStep === 'complete' ? 'All Done!' : STEP_LABELS[currentStep]}
        </h1>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {VISIBLE_STEPS.map((step, i) => {
          const stepIdx = getStepIndex(step);
          const isActive = stepIdx === currentIdx;
          const isCompleted = stepIdx < currentIdx;

          return (
            <div key={step} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isActive
                      ? 'bg-emerald-400'
                      : 'bg-zinc-200'
                }`}
              />
              <span
                className={`hidden text-[10px] sm:block ${
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-lg border bg-card p-6">
        {currentStep === 'profile' && (
          <ProfileStep onComplete={advance} email={email} />
        )}
        {currentStep === 'add_property' && (
          <PropertyStep onComplete={advance} onSkip={advance} />
        )}
        {currentStep === 'add_tenant' && (
          <TenantStep onComplete={advance} onSkip={advance} />
        )}
        {currentStep === 'create_lease' && (
          <LeaseStep
            onComplete={advance}
            onSkip={advance}
            properties={properties}
            tenants={tenants}
          />
        )}
        {currentStep === 'setup_payment' && (
          <PaymentStep
            onComplete={advance}
            onSkip={advance}
            totalMonthlyRentCents={totalMonthlyRentCents}
            monthlyFeeCents={monthlyFeeCents}
            hasPayment={context.hasPayment}
          />
        )}
        {currentStep === 'complete' && <CompleteStep />}
      </div>

      {/* Back button */}
      {currentIdx > 0 && currentStep !== 'complete' && (
        <Button variant="ghost" size="sm" onClick={goBack} className="text-muted-foreground">
          &larr; Back
        </Button>
      )}

      {/* Step counter */}
      {currentStep !== 'complete' && (
        <p className="text-center text-xs text-muted-foreground">
          Step {currentIdx + 1} of {VISIBLE_STEPS.length}
        </p>
      )}
    </div>
  );
}
