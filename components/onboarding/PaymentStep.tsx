'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { PaymentOnboarding } from '@/components/pay-now-button';
import { completeStep } from '@/app/actions/onboarding';

interface PaymentStepProps {
  onComplete: () => void;
  onSkip: () => void;
  totalMonthlyRentCents: number;
  monthlyFeeCents: number;
  hasPayment: boolean;
}

export function PaymentStep({
  onComplete,
  onSkip,
  totalMonthlyRentCents,
  monthlyFeeCents,
  hasPayment,
}: PaymentStepProps) {
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkipTransition] = useTransition();

  if (hasPayment) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Payment is already set up. You can continue to the next step.
        </div>
        <Button
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await completeStep('setup_payment');
              onComplete();
            });
          }}
        >
          {isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Set up billing to start collecting rent, or start a free demo.
      </p>

      <PaymentOnboarding
        totalMonthlyRentCents={totalMonthlyRentCents}
        monthlyFeeCents={monthlyFeeCents}
      />

      <Button
        type="button"
        variant="ghost"
        disabled={isSkipping}
        onClick={() => {
          startSkipTransition(async () => {
            const { skipStep } = await import('@/app/actions/onboarding');
            await skipStep('setup_payment');
            onSkip();
          });
        }}
        className="text-xs"
      >
        {isSkipping && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
        Skip for now
      </Button>
    </div>
  );
}
