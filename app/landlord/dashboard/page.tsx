export default function LandlordDashboardPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900">
        Landlord workspace
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
        Landlord dashboard
      </h1>
      <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
        You can now lock landlord-only pages under <code>/landlord/*</code>. Renter accounts are
        automatically redirected to their own dashboard.
      </p>
    </div>
  );
}
