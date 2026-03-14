import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getHomeRouteForUserRoles, getHomeRouteForUserType } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { USER_TYPE_LABELS, getUserRolesFromClaims } from "@/lib/auth/user-types";

async function ProtectedResolver() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const roles = getUserRolesFromClaims(data.claims);

  if (roles.length === 0) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Account type missing</h1>
        <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
          Your account is authenticated, but it does not have a landlord or renter role yet.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex rounded-full border border-zinc-900/15 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
        >
          Return to sign in
        </Link>
      </div>
    );
  }

  if (roles.length === 1) {
    redirect(getHomeRouteForUserRoles(roles));
  }

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Choose your workspace</h1>
      <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
        This account has access to multiple roles. Choose which dashboard you want to enter.
      </p>
      <div className="grid gap-3">
        {roles.map((role) => (
          <Link
            key={role}
            href={getHomeRouteForUserType(role)}
            className="inline-flex w-full items-center justify-between rounded-xl border border-zinc-900/15 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
          >
            <span>{USER_TYPE_LABELS[role]} dashboard</span>
            <span aria-hidden>{"->"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <Suspense>
      <ProtectedResolver />
    </Suspense>
  );
}
