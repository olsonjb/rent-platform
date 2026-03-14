import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function checkPaymentStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("payment_status, trial_ends_at")
    .eq("id", user.id)
    .single();

  const status = profile?.payment_status ?? "none";

  if (status === "demo_trial" && profile?.trial_ends_at) {
    const trialEnd = new Date(profile.trial_ends_at);
    if (trialEnd < new Date()) {
      return redirect("/protected/onboarding");
    }
  }

  if (status === "none") {
    return redirect("/protected/onboarding");
  }
}

export default function LandlordLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<LandlordLayoutFallback />}>
      <LandlordLayoutContent>{children}</LandlordLayoutContent>
    </Suspense>
  );
}

async function LandlordLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await checkPaymentStatus();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(151_45%_94%),_hsl(0_0%_100%))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 pb-12 pt-6 sm:px-8">
        <nav className="mb-10 flex items-center justify-between rounded-full border border-emerald-900/10 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
          <Link href="/" className="px-3 text-sm font-semibold tracking-tight sm:text-base">
            Auto PM
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/landlord/dashboard"
              className="rounded-full border border-zinc-900/15 px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 sm:text-sm"
            >
              Dashboard
            </Link>
            <Link
              href="/landlord/maintenance-requests"
              className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 sm:text-sm"
            >
              Maintenance
            </Link>
          </div>
        </nav>
        <div className="pb-6">{children}</div>
      </div>
    </main>
  );
}

function LandlordLayoutFallback() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(151_45%_94%),_hsl(0_0%_100%))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 pb-12 pt-6 sm:px-8">
        <div className="mb-10 h-14 animate-pulse rounded-full border border-emerald-900/10 bg-white/70" />
        <div className="h-32 animate-pulse rounded-2xl bg-white/70" />
      </div>
    </main>
  );
}
