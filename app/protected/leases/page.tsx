import Link from 'next/link';
import { getLeases } from '@/app/actions/leases';
import type { LeaseStatus } from '@/lib/types';
import { Suspense } from 'react';

const statusColors: Record<LeaseStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  terminated: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  renewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

async function LeasesList() {
  const leases = await getLeases();

  if (leases.length === 0) {
    return <p className="text-muted-foreground">No leases yet. Add your first one.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {leases.map((l) => (
        <div key={l.id} className="border rounded-lg p-4 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <p className="font-semibold text-sm">{l.properties.address}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[l.status]}`}>
              {l.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {l.properties.city ?? ''}{l.properties.city && l.properties.state ? ', ' : ''}{l.properties.state ?? ''}
          </p>
          <p className="text-sm">{l.landlord_tenants.name}</p>
          <p className="text-xs text-muted-foreground">{l.landlord_tenants.email}</p>
          <p className="text-sm font-medium">${l.monthly_rent.toLocaleString()}/mo</p>
          <p className="text-xs text-muted-foreground">
            {l.start_date} → {l.end_date}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function LeasesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Leases</h1>
        <Link
          href="/protected/leases/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Add Lease
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <LeasesList />
      </Suspense>
    </div>
  );
}
