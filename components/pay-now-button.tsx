'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSetupCheckoutSession, activateDemoTrial } from '@/app/actions/stripe';

interface PaymentOnboardingProps {
  totalMonthlyRentCents: number;
  monthlyFeeCents: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PaymentOnboarding({
  totalMonthlyRentCents,
  monthlyFeeCents,
}: PaymentOnboardingProps) {
  const [isSetupPending, startSetupTransition] = useTransition();
  const [isTrialPending, startTrialTransition] = useTransition();
  const isPending = isSetupPending || isTrialPending;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold">Platform Fee: 3% of Collected Rent</h3>
        <p className="text-sm text-muted-foreground">
          Auto PM charges 3% of your total monthly rent collections. Your card will be authorized
          now but <strong>won&apos;t be charged until you collect your first rent payment</strong>.
        </p>

        {totalMonthlyRentCents > 0 ? (
          <div className="rounded-md bg-muted p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Total monthly rent (active leases)</span>
              <span className="font-medium">{formatCents(totalMonthlyRentCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>3% platform fee</span>
              <span className="font-semibold text-emerald-600">
                {formatCents(monthlyFeeCents)}/mo
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              No active leases yet. Your fee will be calculated as 3% of your total monthly rent
              once you add leases. You can still authorize your payment method now.
            </p>
          </div>
        )}

        <form
          action={() => {
            startSetupTransition(async () => {
              await createSetupCheckoutSession();
            });
          }}
        >
          <Button type="submit" disabled={isPending} size="lg" className="w-full">
            {isSetupPending && <Loader2 className="animate-spin mr-2" />}
            {isSetupPending ? 'Redirecting to Stripe...' : 'Authorize Payment Method'}
          </Button>
        </form>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <form
        action={() => {
          startTrialTransition(async () => {
            await activateDemoTrial();
          });
        }}
      >
        <Button
          type="submit"
          variant="outline"
          disabled={isPending}
          size="lg"
          className="w-full"
        >
          {isTrialPending && <Loader2 className="animate-spin mr-2" />}
          {isTrialPending ? 'Starting trial...' : 'Start 30-Day Free Demo'}
        </Button>
      </form>

      <p className="text-xs text-center text-muted-foreground">
        The demo gives you full access for 30 days with no credit card required.
      </p>
    </div>
  );
}
