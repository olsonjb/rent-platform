import Link from "next/link";

export default function RenterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(151_45%_94%),_hsl(0_0%_100%))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 pb-12 pt-6 sm:px-8">
        <nav className="mb-10 flex items-center justify-between rounded-full border border-emerald-900/10 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
          <Link href="/" className="px-3 text-sm font-semibold tracking-tight sm:text-base">
            Auto PM
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/renter/dashboard"
              className="rounded-full border border-zinc-900/15 px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 sm:text-sm"
            >
              Dashboard
            </Link>
            <Link
              href="/renter/maintenance-requests"
              className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 sm:text-sm"
            >
              Requests
            </Link>
          </div>
        </nav>
        <div className="pb-6">{children}</div>
      </div>
    </main>
  );
}
