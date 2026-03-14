import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { USER_TYPE_LABELS, type UserType } from "@/lib/auth/user-types";

export function RoleLoginPage({ userType }: { userType: UserType }) {
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
              {USER_TYPE_LABELS[userType]} login
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Sign in to your {userType} account.
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
              Enter your credentials to continue to Auto PM.
            </p>
            <Link
              href="/auth/login"
              className="inline-block text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
            >
              Switch login type
            </Link>
          </section>

          <div className="w-full max-w-md">
            <LoginForm userType={userType} />
          </div>
        </div>
      </div>
    </main>
  );
}
