'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function CompleteStep() {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="rounded-full bg-emerald-100 p-4">
        <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">You&apos;re all set!</h2>
        <p className="text-muted-foreground">
          Your account is ready. Head to your dashboard to manage properties, tenants, and leases.
        </p>
      </div>

      <Link href="/landlord/dashboard">
        <Button size="lg">Go to Dashboard</Button>
      </Link>
    </div>
  );
}
