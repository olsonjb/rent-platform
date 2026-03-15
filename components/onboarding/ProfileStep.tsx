'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { onboardingSaveProfile, completeStep } from '@/app/actions/onboarding';

interface ProfileStepProps {
  onComplete: () => void;
  email: string;
}

export function ProfileStep({ onComplete, email }: ProfileStepProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await onboardingSaveProfile(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      await completeStep('profile');
      onComplete();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Let&apos;s start with your basic information.
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="full_name" className="text-sm font-medium">Full Name</label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email_display" className="text-sm font-medium">Email</label>
        <input
          id="email_display"
          type="email"
          value={email}
          disabled
          className="border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium">Phone (optional)</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
        Continue
      </Button>
    </form>
  );
}
