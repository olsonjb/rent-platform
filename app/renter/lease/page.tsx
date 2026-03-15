import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";

export default function LeaseViewerPage() {
  return (
    <Suspense fallback={<LeaseSkeleton />}>
      <LeaseContent />
    </Suspense>
  );
}

async function LeaseContent() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) {
    redirect("/auth/login");
  }

  const roles = getUserRolesFromClaims(claimsData.claims);
  if (!roles.includes("renter")) {
    redirect("/auth/login");
  }

  // Fetch tenant with property details
  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "id, unit, name, move_in_date, lease_end_date, property_id, properties(name, address, rent_due_day, parking_policy, pet_policy, quiet_hours, lease_terms, manager_name, manager_phone)",
    )
    .eq("id", user.id)
    .maybeSingle();

  const rawProperty = tenant?.properties;
  const property =
    rawProperty && !Array.isArray(rawProperty)
      ? (rawProperty as {
          name: string;
          address: string;
          rent_due_day: number;
          parking_policy: string | null;
          pet_policy: string | null;
          quiet_hours: string | null;
          lease_terms: string | null;
          manager_name: string | null;
          manager_phone: string | null;
        })
      : null;

  if (!tenant || !property) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link
          href="/renter/dashboard"
          className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:bg-zinc-100"
        >
          Back to dashboard
        </Link>
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">
            No lease information available. Please contact your property manager.
          </p>
        </div>
      </div>
    );
  }

  const daysRemaining = tenant.lease_end_date
    ? Math.ceil(
        (new Date(tenant.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : null;

  const policies = [
    { label: "Parking", value: property.parking_policy },
    { label: "Pets", value: property.pet_policy },
    { label: "Quiet hours", value: property.quiet_hours },
  ].filter((p) => p.value);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/renter/dashboard"
          className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:bg-zinc-100"
        >
          Back to dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Lease details
        </h1>
      </div>

      {/* Property & Lease Info */}
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{property.name}</h2>
        <p className="mt-1 text-sm text-zinc-600">{property.address}</p>
        <p className="text-sm text-zinc-600">Unit {tenant.unit}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {tenant.move_in_date ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Move-in date</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(tenant.move_in_date)}</p>
            </div>
          ) : null}
          {tenant.lease_end_date ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Lease end date</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(tenant.lease_end_date)}</p>
              {daysRemaining !== null && daysRemaining > 0 ? (
                <p className={`mt-0.5 text-xs ${daysRemaining < 60 ? "text-amber-600 font-medium" : "text-zinc-500"}`}>
                  {daysRemaining} days remaining
                </p>
              ) : null}
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Rent due</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">
              {ordinal(property.rent_due_day)} of each month
            </p>
          </div>
        </div>
      </div>

      {/* Policies */}
      {policies.length > 0 ? (
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Community policies</h2>
          <div className="mt-4 space-y-4">
            {policies.map((policy) => (
              <div key={policy.label}>
                <h3 className="text-sm font-semibold text-zinc-800">{policy.label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 whitespace-pre-line">
                  {policy.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Lease Terms */}
      {property.lease_terms ? (
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Lease terms</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 whitespace-pre-line">
            {property.lease_terms}
          </p>
        </div>
      ) : null}

      {/* Manager Contact */}
      {property.manager_name || property.manager_phone ? (
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Property manager</h2>
          <div className="mt-3 space-y-1">
            {property.manager_name ? (
              <p className="text-sm text-zinc-900">{property.manager_name}</p>
            ) : null}
            {property.manager_phone ? (
              <p className="text-sm text-zinc-600">
                <a href={`tel:${property.manager_phone}`} className="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900">
                  {property.manager_phone}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Download placeholder */}
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
        <p className="text-sm font-medium text-zinc-500">
          Lease document download coming soon
        </p>
        <button
          disabled
          className="mt-3 inline-flex rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-400"
        >
          Download lease (PDF)
        </button>
      </div>
    </div>
  );
}

function LeaseSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="h-10 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="h-48 animate-pulse rounded-2xl bg-zinc-100" />
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
