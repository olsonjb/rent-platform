import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      {params?.error ? (
        <p className="text-sm text-zinc-600">
          Code error: {params.error}
        </p>
      ) : (
        <p className="text-sm text-zinc-600">
          An unspecified error occurred.
        </p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
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
            <p className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-900">
              Authentication issue
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Something interrupted sign in.
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
              You can safely return to login and try again.
            </p>
          </section>

          <Card className="w-full max-w-md rounded-2xl border-zinc-900/10 bg-white shadow-[0_24px_64px_-36px_rgba(0,0,0,0.4)]">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight text-zinc-950">
                Sorry, something went wrong.
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
              <Link
                href="/auth/login"
                className="inline-flex w-full items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Back to sign in
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
