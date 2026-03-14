import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(151_45%_94%),_hsl(0_0%_100%))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 pb-12 pt-6 sm:px-8">
        <nav className="mb-12 flex items-center justify-between rounded-full border border-emerald-900/10 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
          <Link href="/" className="px-3 text-sm font-semibold tracking-tight sm:text-base">
            Auto PM
          </Link>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <section className="max-w-xl space-y-4">
            <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900">
              Welcome back
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Choose your login type.
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
              Continue to the right sign-in page for your account.
            </p>
          </section>

          <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-[0_24px_64px_-36px_rgba(0,0,0,0.4)]">
            <Button asChild className="h-11 w-full bg-zinc-950 text-white hover:bg-zinc-800">
              <Link href="/auth/login/landlord">Sign in as Landlord</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full border-zinc-900/20">
              <Link href="/auth/login/renter">Sign in as Renter</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
