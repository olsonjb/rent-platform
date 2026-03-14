import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

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
              Account created
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Confirm your email to activate Auto PM.
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
              Once confirmed, you can sign in and start automating maintenance and tenant communication workflows.
            </p>
          </section>

          <Card className="w-full max-w-md rounded-2xl border-zinc-900/10 bg-white shadow-[0_24px_64px_-36px_rgba(0,0,0,0.4)]">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight text-zinc-950">
                Check your inbox
              </CardTitle>
              <CardDescription>We sent a confirmation link to your email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-600">
                Open the email and confirm your account before signing in.
              </p>
              <Link
                href="/auth/login"
                className="inline-flex w-full items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Go to sign in
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
