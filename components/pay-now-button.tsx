'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createCheckoutSession } from '@/app/actions/stripe';

export function PayNowButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(async () => {
          await createCheckoutSession();
        });
      }}
    >
      <Button type="submit" disabled={isPending} size="lg">
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? 'Redirecting…' : 'Pay Now — $9.99'}
      </Button>
    </form>
  );
}
