import Link from 'next/link';
import { getTenants } from '@/app/actions/tenants';

export const dynamic = 'force-dynamic';

export default async function TenantsPage() {
  const tenants = await getTenants();

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

      {tenants.length === 0 ? (
        <p className="text-muted-foreground">No tenants yet. Add your first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((t) => (
            <div key={t.id} className="border rounded-lg p-4 flex flex-col gap-2">
              <p className="font-semibold">{t.name}</p>
              <p className="text-sm text-muted-foreground">{t.email}</p>
              {t.phone && <p className="text-sm">{t.phone}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
