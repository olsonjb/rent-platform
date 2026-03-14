import Link from 'next/link';
import { getProperties, linkRenterToProperty } from '@/app/actions/properties';
import { getTenants } from '@/app/actions/tenants';
import { Suspense } from 'react';

type PropertiesPageProps = {
  searchParams: Promise<{
    link_error?: string;
    link_success?: string;
  }>;
};

async function PropertiesList() {
  const properties = await getProperties();
  const tenants = await getTenants();

  if (properties.length === 0) {
    return <p className="text-muted-foreground">No properties yet. Add your first one.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((p) => (
        <article key={p.id} className="border rounded-lg p-4 flex flex-col gap-3">
          <Link href={`/protected/properties/${p.id}`} className="flex flex-col gap-2 hover:bg-muted/50 transition-colors rounded-md p-1 -m-1">
            <p className="font-semibold">{p.address}</p>
            <p className="text-sm text-muted-foreground">
              {p.city}, {p.state} {p.zip}
            </p>
            <p className="text-sm">
              {p.bedrooms} bed · {p.bathrooms} bath
            </p>
            <p className="text-sm font-medium">${p.monthly_rent?.toLocaleString() ?? '—'}/mo</p>
          </Link>

          <form action={linkRenterToProperty} className="border-t pt-3 mt-1 flex flex-col gap-2">
            <input type="hidden" name="property_id" value={p.id} />
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Link renter</p>
            <label className="text-xs text-muted-foreground" htmlFor={`tenant-${p.id}`}>
              Added tenant
            </label>
            <select
              id={`tenant-${p.id}`}
              name="landlord_tenant_id"
              required
              defaultValue=""
              disabled={tenants.length === 0}
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>
                Select a tenant
              </option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.email})
                </option>
              ))}
            </select>
            <label className="text-xs text-muted-foreground" htmlFor={`unit-${p.id}`}>
              Unit
            </label>
            <input
              id={`unit-${p.id}`}
              name="unit"
              type="text"
              required
              placeholder="2B"
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={tenants.length === 0}
              className="bg-zinc-950 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              Link renter
            </button>
            {tenants.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add tenants first in the Tenants page before linking them to a property.
              </p>
            ) : null}
          </form>
        </article>
      ))}
    </div>
  );
}

async function PropertiesPageContent({ searchParams }: PropertiesPageProps) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Properties</h1>
        <Link
          href="/protected/properties/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Add Property
        </Link>
      </div>

      {params.link_success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {params.link_success}
        </p>
      ) : null}

      {params.link_error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {params.link_error}
        </p>
      ) : null}

      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <PropertiesList />
      </Suspense>
    </div>
  );
}

export default function PropertiesPage({ searchParams }: PropertiesPageProps) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <PropertiesPageContent searchParams={searchParams} />
    </Suspense>
  );
}
