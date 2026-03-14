import Link from "next/link";

const platformFeatures = [
  {
    title: "Maintenance requests",
    description:
      "Auto-triage resident issues, assign vendors, and keep everyone updated without manual follow-up.",
  },
  {
    title: "Tenant communications",
    description:
      "Send proactive updates, reminders, and two-way messages from one shared timeline.",
  },
  {
    title: "Leasing pipeline",
    description:
      "Track prospects, tours, and approvals without spreadsheet handoffs.",
  },
  {
    title: "Accounting sync",
    description:
      "Automate recurring charges, reminders, and reconciliation in one ledger.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(151_45%_94%),_hsl(0_0%_100%))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 pb-16 pt-6 sm:px-8">
        <nav className="mb-12 flex items-center justify-between rounded-full border border-emerald-900/10 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
          <Link href="/" className="px-3 text-sm font-semibold tracking-tight sm:text-base">
            Auto PM
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-full border border-emerald-900/15 px-4 py-2 text-xs font-medium text-emerald-950 transition hover:bg-emerald-100 sm:text-sm"
            >
              Sign in
            </Link>
          </div>
        </nav>

        <section className="grid gap-10 pb-14 pt-2 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900">
              Property Management Platform
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
              Your autonomous property manager for maintenance and tenant communication.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              Auto PM handles daily operations for you, starting with maintenance requests and tenant communications, then scaling into leasing and collections.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/auth/sign-up"
                className="rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Let Auto PM run ops
              </Link>
              <Link
                href="/protected"
                className="rounded-full border border-zinc-900/20 px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
              >
                See live dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-[0_24px_64px_-36px_rgba(0,0,0,0.4)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Portfolio Snapshot
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-900/70">Occupied units</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-950">1,284</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs text-amber-900/70">Open work orders</p>
                <p className="mt-2 text-2xl font-semibold text-amber-950">37</p>
              </div>
              <div className="rounded-xl bg-sky-50 p-4">
                <p className="text-xs text-sky-900/70">Collections rate</p>
                <p className="mt-2 text-2xl font-semibold text-sky-950">98.2%</p>
              </div>
              <div className="rounded-xl bg-zinc-100 p-4">
                <p className="text-xs text-zinc-700">Avg. response time</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">2.6h</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-12 sm:grid-cols-2 lg:grid-cols-4">
          {platformFeatures.map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-900/10 bg-white p-5">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-950">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.description}</p>
            </article>
          ))}
        </section>

        <footer className="border-t border-zinc-900/10 pt-8 text-sm text-zinc-600">
          Built for modern property operators managing multifamily, mixed-use, and single-family portfolios.
        </footer>
      </div>
    </main>
  );
}
