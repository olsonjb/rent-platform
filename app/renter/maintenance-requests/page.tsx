import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  MAINTENANCE_REQUEST_LOCATION_LABELS,
  MAINTENANCE_REQUEST_STATUSES,
  MAINTENANCE_REQUEST_STATUS_LABELS,
  MAINTENANCE_REQUEST_URGENCY_LABELS,
  isMaintenanceRequestLocation,
  isMaintenanceRequestStatus,
  isMaintenanceRequestUrgency,
  type MaintenanceRequestStatus,
} from "@/lib/maintenance-requests";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";

type MaintenanceRequestHistoryRow = {
  id: string;
  issue: string;
  unit: string;
  location: string | null;
  urgency: string;
  status: MaintenanceRequestStatus;
  created_at: string;
};

const STATUS_BADGE_STYLES: Record<MaintenanceRequestStatus, string> = {
  pending: "bg-sky-100 text-sky-900",
  in_progress: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
};

const formatDate = (value: string) => {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

type MaintenanceRequestHistoryPageProps = {
  searchParams: Promise<{
    success?: string;
  }>;
};

export default async function MaintenanceRequestHistoryPage({
  searchParams,
}: MaintenanceRequestHistoryPageProps) {
  return (
    <Suspense fallback={<MaintenanceRequestHistoryFallback />}>
      <MaintenanceRequestHistoryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MaintenanceRequestHistoryContent({
  searchParams,
}: MaintenanceRequestHistoryPageProps) {
  const resolvedSearchParams = await searchParams;
  const hasSuccessState = resolvedSearchParams.success === "1";

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

  const { data, error } = await supabase
    .from("maintenance_requests")
    .select("id, issue, unit, location, urgency, status, created_at")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  const requests: MaintenanceRequestHistoryRow[] = Array.isArray(data)
    ? (data as MaintenanceRequestHistoryRow[])
    : [];

  const requestsByStatus: Record<MaintenanceRequestStatus, MaintenanceRequestHistoryRow[]> = {
    pending: [],
    in_progress: [],
    completed: [],
  };

  for (const request of requests) {
    if (!isMaintenanceRequestStatus(request.status)) {
      console.warn("Unknown maintenance request status", { requestId: request.id, status: request.status });
      continue;
    }

    requestsByStatus[request.status].push({ ...request, status: request.status });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-900">
            Renter workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            My maintenance requests
          </h1>
        </div>
        <Link
          href="/renter/maintenance-requests/new"
          className="inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          New request
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Unable to load requests right now. Please try again.
        </p>
      ) : null}

      {hasSuccessState ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Request submitted. Your property team will review and follow up shortly.
        </p>
      ) : null}

      {requests.length === 0 && !error ? (
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">No maintenance requests yet.</p>
          <Link
            href="/renter/maintenance-requests/new"
            className="mt-4 inline-flex rounded-full border border-zinc-900/15 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
          >
            Submit your first request
          </Link>
        </div>
      ) : null}

      {MAINTENANCE_REQUEST_STATUSES.map((status) => {
        const items = requestsByStatus[status];

        if (items.length === 0) {
          return null;
        }

        return (
          <section key={status} className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">{MAINTENANCE_REQUEST_STATUS_LABELS[status]}</h2>
            <div className="space-y-3">
              {items.map((request) => {
                const urgencyLabel = isMaintenanceRequestUrgency(request.urgency)
                  ? MAINTENANCE_REQUEST_URGENCY_LABELS[request.urgency]
                  : request.urgency;
                const locationLabel =
                  request.location && isMaintenanceRequestLocation(request.location)
                    ? MAINTENANCE_REQUEST_LOCATION_LABELS[request.location]
                    : request.location;

                return (
                  <article
                    key={request.id}
                    className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold tracking-tight text-zinc-950">
                          {request.issue}
                        </h3>
                        <p className="text-sm text-zinc-600">
                          Unit {request.unit} - {urgencyLabel}
                        </p>
                        {locationLabel ? (
                          <p className="text-sm text-zinc-500">
                            Location: {locationLabel}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${STATUS_BADGE_STYLES[request.status]}`}
                      >
                        {MAINTENANCE_REQUEST_STATUS_LABELS[request.status]}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">Submitted {formatDate(request.created_at)}</p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MaintenanceRequestHistoryFallback() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
      <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}
