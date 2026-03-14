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
    </div>
  );
}
