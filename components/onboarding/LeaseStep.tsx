'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { onboardingCreateLease, completeStep } from '@/app/actions/onboarding';
import type { Property, LandlordTenant } from '@/lib/types';

interface LeaseStepProps {
  onComplete: () => void;
  onSkip: () => void;
  properties: Property[];
  tenants: LandlordTenant[];
}

export function LeaseStep({ onComplete, onSkip, properties, tenants }: LeaseStepProps) {
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkipTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasPrereqs = properties.length > 0 && tenants.length > 0;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await onboardingCreateLease(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      await completeStep('create_lease');
      onComplete();
    });
  }

  function handleSkip() {
    startSkipTransition(async () => {
      const { skipStep } = await import('@/app/actions/onboarding');
      await skipStep('create_lease');
      onSkip();
    });
  }

  const disabled = isPending || isSkipping;

  if (!hasPrereqs) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          You need at least one property and one tenant before creating a lease.
          You can skip this step and set it up later.
        </p>
        <Button variant="outline" disabled={isSkipping} onClick={handleSkip}>
          {isSkipping && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
          Skip for now
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Create a lease linking a property to a tenant.
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="property_id" className="text-sm font-medium">Property</label>
          <select id="property_id" name="property_id" required className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select a property...</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}, {p.city}, {p.state}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tenant_id" className="text-sm font-medium">Tenant</label>
          <select id="tenant_id" name="tenant_id" required className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select a tenant...</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="start_date" className="text-sm font-medium">Start Date</label>
            <input id="start_date" name="start_date" type="date" required className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="end_date" className="text-sm font-medium">End Date</label>
            <input id="end_date" name="end_date" type="date" required className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="monthly_rent" className="text-sm font-medium">Monthly Rent ($)</label>
          <input id="monthly_rent" name="monthly_rent" type="number" required min="0" step="0.01" className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <input type="hidden" name="status" value="active" />

        <div className="flex gap-3 mt-2">
          <Button type="submit" disabled={disabled} className="flex-1">
            {isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Create Lease
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
