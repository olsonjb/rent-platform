'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { onboardingCreateProperty, completeStep } from '@/app/actions/onboarding';

interface PropertyStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function PropertyStep({ onComplete, onSkip }: PropertyStepProps) {
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkipTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await onboardingCreateProperty(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      await completeStep('add_property');
      onComplete();
    });
  }

  function handleSkip() {
    startSkipTransition(async () => {
      const { skipStep } = await import('@/app/actions/onboarding');
      await skipStep('add_property');
      onSkip();
    });
  }

  const disabled = isPending || isSkipping;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Add your first rental property.
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">Property Name</label>
          <input id="name" name="name" type="text" required placeholder="e.g. Maple Ridge Apartments" className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="address" className="text-sm font-medium">Street Address</label>
          <input id="address" name="address" type="text" required className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="city" className="text-sm font-medium">City</label>
            <input id="city" name="city" type="text" required className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="state" className="text-sm font-medium">State</label>
            <input id="state" name="state" type="text" required maxLength={2} className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="zip" className="text-sm font-medium">ZIP Code</label>
          <input id="zip" name="zip" type="text" required className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="bedrooms" className="text-sm font-medium">Bedrooms</label>
            <input id="bedrooms" name="bedrooms" type="number" required min="0" defaultValue="1" className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="bathrooms" className="text-sm font-medium">Bathrooms</label>
            <input id="bathrooms" name="bathrooms" type="number" required min="0" step="0.5" defaultValue="1" className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="monthly_rent" className="text-sm font-medium">Rent ($)</label>
            <input id="monthly_rent" name="monthly_rent" type="number" required min="0" step="0.01" className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <input type="hidden" name="rent_due_day" value="1" />

        <div className="flex gap-3 mt-2">
          <Button type="submit" disabled={disabled} className="flex-1">
            {isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Add Property
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
