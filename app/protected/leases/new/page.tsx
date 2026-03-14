import { createLease } from '@/app/actions/leases';
import { getProperties } from '@/app/actions/properties';
import { getTenants } from '@/app/actions/tenants';
import Link from 'next/link';

export default async function NewLeasePage() {
  const [properties, tenants] = await Promise.all([getProperties(), getTenants()]);

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Link href="/protected/leases" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Add Lease</h1>
      </div>

      <form action={createLease} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="property_id" className="text-sm font-medium">Property</label>
          <select
            id="property_id"
            name="property_id"
            required
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}, {p.city}, {p.state}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tenant_id" className="text-sm font-medium">Tenant</label>
          <select
            id="tenant_id"
            name="tenant_id"
            required
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a tenant…</option>
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
            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="end_date" className="text-sm font-medium">End Date</label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              required
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="monthly_rent" className="text-sm font-medium">Monthly Rent ($)</label>
          <input
            id="monthly_rent"
            name="monthly_rent"
            type="number"
            required
            min="0"
            step="0.01"
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm font-medium">Status</label>
          <select
            id="status"
            name="status"
            required
            defaultValue="pending"
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors mt-2"
        >
          Save Lease
        </button>
      </form>
    </div>
  );
}
