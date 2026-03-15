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
import { createLogger } from "@/lib/logger";

const logger = createLogger("renter-maintenance");

type MaintenanceRequestHistoryRow = {
  id: string;
  issue: string;
  unit: string;
  location: string | null;
  urgency: string;
  status: MaintenanceRequestStatus;
  details: string | null;
  photos: string[] | null;
  contact_phone: string | null;
  entry_permission: string | null;
  created_at: string;
  maintenance_request_reviews: ReviewRow[] | null;
};

type ReviewRow = {
  trade: string;
  severity: string;
  estimated_cost_min: number | null;
  estimated_cost_max: number | null;
  summary: string;
};

const STATUS_BADGE_STYLES: Record<MaintenanceRequestStatus, string> = {
  pending: "bg-sky-100 text-sky-900",
  in_progress: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
};

const STATUS_TIMELINE_STYLES: Record<MaintenanceRequestStatus, string> = {
  pending: "border-sky-400 bg-sky-400",
  in_progress: "border-amber-400 bg-amber-400",
  completed: "border-emerald-400 bg-emerald-400",
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
    expanded?: string;
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
  const expandedId = resolvedSearchParams.expanded;

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
    .select(
      "id, issue, unit, location, urgency, status, details, photos, contact_phone, entry_permission, created_at, maintenance_request_reviews(trade, severity, estimated_cost_min, estimated_cost_max, summary)",
    )
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
      logger.warn({ requestId: request.id, status: request.status }, "Unknown maintenance request status");
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
                const isExpanded = expandedId === request.id;
                const urgencyLabel = isMaintenanceRequestUrgency(request.urgency)
                  ? MAINTENANCE_REQUEST_URGENCY_LABELS[request.urgency]
                  : request.urgency;
                const locationLabel =
                  request.location && isMaintenanceRequestLocation(request.location)
                    ? MAINTENANCE_REQUEST_LOCATION_LABELS[request.location]
                    : request.location;
                const hasPhotos = request.photos && request.photos.length > 0;
                const review =
                  request.maintenance_request_reviews &&
                  request.maintenance_request_reviews.length > 0
                    ? request.maintenance_request_reviews[0]
                    : null;

                return (
                  <article
                    key={request.id}
                    className="rounded-2xl border border-zinc-900/10 bg-white shadow-sm"
                  >
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold tracking-tight text-zinc-950">
                              {request.issue}
                            </h3>
                            {hasPhotos ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {request.photos!.length}
                              </span>
                            ) : null}
                          </div>
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
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-zinc-500">Submitted {formatDate(request.created_at)}</p>
                        <Link
                          href={
                            isExpanded
                              ? "/renter/maintenance-requests"
                              : `/renter/maintenance-requests?expanded=${request.id}`
                          }
                          className="text-xs font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
                        >
                          {isExpanded ? "Collapse" : "View details"}
                        </Link>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="border-t border-zinc-100 p-5 space-y-4">
                        {/* Details */}
                        {request.details ? (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Description</h4>
                            <p className="mt-1 text-sm leading-relaxed text-zinc-700 whitespace-pre-line">
                              {request.details}
                            </p>
                          </div>
                        ) : null}

                        {/* Photo Gallery */}
                        {hasPhotos ? (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Photos</h4>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {request.photos!.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block h-24 w-24 overflow-hidden rounded-lg border border-zinc-200 transition hover:opacity-80"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`Photo ${i + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* AI Review Summary */}
                        {review ? (
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              AI review summary
                            </h4>
                            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                              {review.summary}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
                              <span>Trade: <span className="font-medium text-zinc-800">{review.trade}</span></span>
                              <span>Severity: <span className="font-medium text-zinc-800">{review.severity}</span></span>
                              {review.estimated_cost_min != null && review.estimated_cost_max != null ? (
                                <span>
                                  Est. cost: <span className="font-medium text-zinc-800">
                                    ${review.estimated_cost_min}–${review.estimated_cost_max}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {/* Status Timeline */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            Status timeline
                          </h4>
                          <div className="mt-2 space-y-0">
                            {MAINTENANCE_REQUEST_STATUSES.map((timelineStatus) => {
                              const isReached = getStatusOrder(request.status) >= getStatusOrder(timelineStatus);

                              return (
                                <div key={timelineStatus} className="flex items-center gap-3 py-1.5">
                                  <div
                                    className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                                      isReached
                                        ? STATUS_TIMELINE_STYLES[timelineStatus]
                                        : "border-zinc-300 bg-white"
                                    }`}
                                  />
                                  <span
                                    className={`text-sm ${
                                      isReached ? "font-medium text-zinc-900" : "text-zinc-400"
                                    }`}
                                  >
                                    {MAINTENANCE_REQUEST_STATUS_LABELS[timelineStatus]}
                                  </span>
                                  {timelineStatus === "pending" ? (
                                    <span className="text-xs text-zinc-400">
                                      {formatDate(request.created_at)}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}
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

function getStatusOrder(status: MaintenanceRequestStatus): number {
  const order: Record<MaintenanceRequestStatus, number> = {
    pending: 0,
    in_progress: 1,
    completed: 2,
  };
  return order[status] ?? 0;
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
