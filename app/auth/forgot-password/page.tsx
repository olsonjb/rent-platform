import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

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
              Recover access
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Reset your password and keep operations moving.
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
              We will send a secure reset link so you can get back to your workspace.
            </p>
          </section>

          <div className="w-full max-w-md">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
