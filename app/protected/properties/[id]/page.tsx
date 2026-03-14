import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Lease } from '@/lib/types';
import { connection } from 'next/server';

interface PageProps {
  params: Promise<{ id: string }>;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default async function PropertyDetailPage({ params }: PageProps) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !property) notFound();

  const { data: leases } = await supabase
    .from('leases')
    .select('*, landlord_tenants(name, email)')
    .eq('property_id', id)
    .order('end_date', { ascending: false });

  const activeLease = (leases ?? []).find((l) => l.status === 'active') as
    | (Lease & { landlord_tenants: { name: string; email: string } })
    | undefined;

  const activeLeasedays = activeLease ? daysUntil(activeLease.end_date) : null;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/protected/properties" className="text-sm text-muted-foreground hover:text-foreground">
          ← Properties
        </Link>
        <h1 className="text-2xl font-bold">{property.address}</h1>
      </div>

      {/* Property summary */}
      <div className="border rounded-lg p-4 flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          {property.city ?? ''}{property.city && property.state ? ', ' : ''}{property.state ?? ''} {property.zip ?? ''}
        </p>
        <p className="text-sm">
          {property.bedrooms ?? '—'} bed · {property.bathrooms ?? '—'} bath
        </p>
        <p className="font-medium">${Number(property.monthly_rent ?? 0).toLocaleString()}/mo</p>
      </div>

      {/* Active lease */}
      {activeLease && (
        <div className="border rounded-lg p-4 flex flex-col gap-2">
          <h2 className="font-semibold">Active Lease</h2>
          <p className="text-sm">Tenant: {activeLease.landlord_tenants?.name} — {activeLease.landlord_tenants?.email}</p>
          <p className="text-sm">
            Expires: {activeLease.end_date}
            {activeLeasedays !== null && (
              <span
                className={`ml-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  activeLeasedays <= 30 ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'
                }`}
              >
                {activeLeasedays > 0 ? `${activeLeasedays}d remaining` : 'Expired'}
              </span>
            )}
          </p>
        </div>
      )}

      {/* All leases */}
      {leases && leases.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">Lease History</h2>
          {leases.map((lease) => (
            <div key={lease.id} className="border rounded-lg p-3 flex flex-col gap-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium">{(lease as Lease & { landlord_tenants: { name: string } }).landlord_tenants?.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                  {lease.status}
                </span>
              </div>
              <p className="text-muted-foreground">{lease.start_date} → {lease.end_date}</p>
              <p>${Number(lease.monthly_rent).toLocaleString()}/mo</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
