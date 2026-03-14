import Link from "next/link";

export default function RenterDashboardPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <p className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-900">
        Renter workspace
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
        Renter dashboard
      </h1>
      <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
        You can now lock renter-only pages under <code>/renter/*</code>. Landlord accounts are
        automatically redirected to their own dashboard.
      </p>
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Chat with your property assistant</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Ask questions about your lease, policies, or report a maintenance issue through AI-powered chat.
        </p>
        <div className="mt-4">
          <Link
            href="/protected/chat"
            className="inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Open chat
          </Link>
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Need something fixed?</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Submit a maintenance request with issue details, urgency, and preferred access details.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/renter/maintenance-requests/new"
            className="inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Submit maintenance request
          </Link>
          <Link
            href="/renter/maintenance-requests"
            className="inline-flex rounded-full border border-zinc-900/15 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
          >
            View request history
          </Link>
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Browse listings</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Find your next home. Browse available rental properties and apply online.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/listings"
            className="inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Browse listings
          </Link>
          <Link
            href="/renter/applications"
            className="inline-flex rounded-full border border-zinc-900/15 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
          >
            My applications
          </Link>
        </div>
      </div>
    </div>
  );
}
