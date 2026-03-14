import Link from "next/link";

export default function LandlordDashboardPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900">
        Landlord workspace
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
        Landlord dashboard
      </h1>
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Maintenance operations</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Review new renter requests with AI cost estimates and nearby vendor contacts.
        </p>
        <Link
          href="/landlord/maintenance-requests"
          className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Open maintenance inbox
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Tenant applications</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Review rental applications with AI-powered screening decisions. Approve or deny applicants.
        </p>
        <Link
          href="/landlord/applications"
          className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          View applications
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Listings</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          View AI-generated property listings. Listings are automatically created when leases approach expiration, or generate them manually from any property page.
        </p>
        <Link
          href="/listings"
          className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Browse listings
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Properties</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          View and manage your rental properties, units, and property details.
        </p>
        <Link
          href="/protected/properties"
          className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Manage properties
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Tenants</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          View tenant profiles, contact information, and rental history.
        </p>
        <Link
          href="/protected/tenants"
          className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          View tenants
        </Link>
      </div>
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Leases</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Track active leases, renewal dates, and lease terms across your portfolio.
        </p>
        <Link
          href="/protected/leases"
          className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Manage leases
        </Link>
      </div>
    </div>
  );
}
