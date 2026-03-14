import Link from 'next/link';
import { getTenants } from '@/app/actions/tenants';
import { Suspense } from 'react';

async function TenantsList() {
  const tenants = await getTenants();

  if (tenants.length === 0) {
    return <p className="text-muted-foreground">No tenants yet. Add your first one.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tenants.map((t) => (
        <div key={t.id} className="border rounded-lg p-4 flex flex-col gap-2">
          <p className="font-semibold">{t.name}</p>
          <p className="text-sm text-muted-foreground">{t.email}</p>
          {t.phone && <p className="text-sm">{t.phone}</p>}
        </div>
      ))}
    </div>
  );
}

export default function TenantsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <Link
          href="/protected/tenants/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Add Tenant
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <TenantsList />
      </Suspense>
    </div>
  );
}
