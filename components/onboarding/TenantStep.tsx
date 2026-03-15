'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { onboardingCreateTenant, completeStep } from '@/app/actions/onboarding';

interface TenantStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function TenantStep({ onComplete, onSkip }: TenantStepProps) {
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkipTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await onboardingCreateTenant(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      await completeStep('add_tenant');
      onComplete();
    });
  }

  function handleSkip() {
    startSkipTransition(async () => {
      const { skipStep } = await import('@/app/actions/onboarding');
      await skipStep('add_tenant');
      onSkip();
    });
  }

  const disabled = isPending || isSkipping;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Add your first tenant&apos;s contact information.
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">Full Name</label>
          <input id="name" name="name" type="text" required className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium">Phone (optional)</label>
          <input id="phone" name="phone" type="tel" className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="flex gap-3 mt-2">
          <Button type="submit" disabled={disabled} className="flex-1">
            {isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Add Tenant
          </Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={handleSkip}>
            {isSkipping && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Skip for now
          </Button>
        </div>
      </form>
    </div>
  );
}
