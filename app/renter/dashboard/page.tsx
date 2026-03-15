import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import {
  MAINTENANCE_REQUEST_STATUS_LABELS,
  type MaintenanceRequestStatus,
} from "@/lib/maintenance-requests";

const STATUS_BADGE_STYLES: Record<MaintenanceRequestStatus, string> = {
  pending: "bg-sky-100 text-sky-900",
  in_progress: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
};

export default function RenterDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
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

  // Fetch tenant profile with property
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, unit, name, move_in_date, lease_end_date, property_id, properties(name, address, rent_due_day)")
    .eq("id", user.id)
    .maybeSingle();

  // Fetch active maintenance requests
  const { data: maintenanceRequests } = await supabase
    .from("maintenance_requests")
    .select("id, issue, status, created_at, urgency")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const requests = Array.isArray(maintenanceRequests) ? maintenanceRequests : [];
  const activeRequests = requests.filter(
    (r) => r.status === "pending" || r.status === "in_progress",
  );

  const rawProperty = tenant?.properties;
  const property = rawProperty && !Array.isArray(rawProperty)
    ? (rawProperty as { name: string; address: string; rent_due_day: number })
    : null;

  const daysRemaining = tenant?.lease_end_date
    ? Math.ceil(
        (new Date(tenant.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-2">
        <p className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-900">
          Renter dashboard
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Welcome back{tenant?.name ? `, ${tenant.name.split(" ")[0]}` : ""}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Lease Summary Card */}
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Lease summary
          </h2>
          {tenant && property ? (
            <div className="mt-3 space-y-2">
              <p className="text-lg font-semibold text-zinc-900">{property.name}</p>
              <p className="text-sm text-zinc-600">{property.address}</p>
              <p className="text-sm text-zinc-600">Unit {tenant.unit}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-500">Rent due</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {ordinal(property.rent_due_day)} of each month
                  </p>
                </div>
                {tenant.lease_end_date ? (
                  <div>
                    <p className="text-xs text-zinc-500">Lease ends</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {formatDate(tenant.lease_end_date)}
                    </p>
                    {daysRemaining !== null && daysRemaining > 0 ? (
                      <p className={`text-xs ${daysRemaining < 60 ? "text-amber-600" : "text-zinc-500"}`}>
                        {daysRemaining} days remaining
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <Link
                href="/renter/lease"
                className="mt-3 inline-flex text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition hover:text-zinc-900"
              >
                View lease details
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              No lease information available. Contact your property manager.
            </p>
          )}
        </div>

        {/* Payment Status Card */}
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Payment status
          </h2>
          <div className="mt-3 space-y-2">
            {property ? (
              <>
                <div>
                  <p className="text-xs text-zinc-500">Next payment due</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {getNextDueDate(property.rent_due_day)}
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  Online payments coming soon. Contact your landlord for current payment options.
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">No payment information available.</p>
            )}
          </div>
        </div>

        {/* Active Maintenance Card */}
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Maintenance requests
            </h2>
            {activeRequests.length > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900">
                {activeRequests.length}
              </span>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {requests.length === 0 ? (
              <p className="text-sm text-zinc-500">No maintenance requests yet.</p>
            ) : (
              requests.slice(0, 3).map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-zinc-900">{req.issue}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[req.status as MaintenanceRequestStatus] ?? "bg-zinc-100 text-zinc-700"}`}
                  >
                    {MAINTENANCE_REQUEST_STATUS_LABELS[req.status as MaintenanceRequestStatus] ?? req.status}
                  </span>
                </div>
              ))
            )}
            {requests.length > 3 ? (
              <Link
                href="/renter/maintenance-requests"
                className="block text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition hover:text-zinc-900"
              >
                View all requests
              </Link>
            ) : null}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Quick actions
          </h2>
          <div className="mt-3 grid gap-2">
            <Link
              href="/renter/maintenance-requests/new"
              className="inline-flex rounded-full bg-zinc-950 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Report an issue
            </Link>
            <Link
              href="/protected/chat"
              className="inline-flex rounded-full border border-zinc-900/15 px-4 py-2 text-center text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
            >
              Message landlord
            </Link>
            <Link
              href="/renter/maintenance-requests"
              className="inline-flex rounded-full border border-zinc-900/15 px-4 py-2 text-center text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
            >
              View request history
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="h-10 w-64 animate-pulse rounded bg-zinc-200" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function getNextDueDate(rentDueDay: number) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), rentDueDay);
  const target = now <= thisMonth ? thisMonth : new Date(now.getFullYear(), now.getMonth() + 1, rentDueDay);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(target);
}
