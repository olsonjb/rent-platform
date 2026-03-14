import Link from 'next/link';
import { getProperties } from '@/app/actions/properties';

export default async function PropertiesPage() {
  const properties = await getProperties();

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

      {properties.length === 0 ? (
        <p className="text-muted-foreground">No properties yet. Add your first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Link key={p.id} href={`/protected/properties/${p.id}`} className="border rounded-lg p-4 flex flex-col gap-2 hover:bg-muted/50 transition-colors">
              <p className="font-semibold">{p.address}</p>
              <p className="text-sm text-muted-foreground">
                {p.city}, {p.state} {p.zip}
              </p>
              <p className="text-sm">
                {p.bedrooms} bed · {p.bathrooms} bath
              </p>
              <p className="text-sm font-medium">${p.monthly_rent.toLocaleString()}/mo</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
