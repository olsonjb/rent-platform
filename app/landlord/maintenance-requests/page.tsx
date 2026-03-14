import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  MAINTENANCE_REQUEST_STATUS_LABELS,
  MAINTENANCE_REQUEST_URGENCY_LABELS,
  isMaintenanceRequestStatus,
  isMaintenanceRequestUrgency,
} from "@/lib/maintenance-requests";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";

type MaintenanceReview = {
  estimated_cost_min: number;
  estimated_cost_max: number;
  confidence: number;
  trade: string;
  summary: string;
  vendors: Array<{
    name: string;
    phone: string | null;
    website: string | null;
    address: string | null;
  }>;
};

type MaintenanceRequestRow = {
  id: string;
  issue: string;
  details: string | null;
  urgency: string;
  status: string;
  unit: string;
  created_at: string;
  tenants: Array<{
    name: string;
    property_id: string | null;
  }> | null;
  maintenance_request_reviews: MaintenanceReview[] | MaintenanceReview | null;
};

type PropertyRow = {
  id: string;
  name: string;
  address: string;
};

const formatDateTime = (value: string): string => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatCost = (minimum: number, maximum: number): string => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return `${formatter.format(minimum)} - ${formatter.format(maximum)}`;
};

export default async function LandlordMaintenanceRequestsPage() {
  return (
    <Suspense fallback={<LandlordMaintenanceRequestsFallback />}>
      <LandlordMaintenanceRequestsContent />
    </Suspense>
  );
}

async function LandlordMaintenanceRequestsContent() {
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
  if (!roles.includes("landlord")) {
    redirect("/auth/login");
  }

  const { data: propertyRows, error: propertiesError } = await supabase
    .from("properties")
    .select("id, name, address");

  if (propertiesError) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Unable to load properties right now.
      </p>
    );
  }

  const properties: PropertyRow[] = Array.isArray(propertyRows) ? (propertyRows as PropertyRow[]) : [];
  const propertyMap = new Map(properties.map((property) => [property.id, property]));

  const { data: requestRows, error: requestsError } = await supabase
    .from("maintenance_requests")
    .select(
      "id, issue, details, urgency, status, unit, created_at, tenants(name, property_id), maintenance_request_reviews(estimated_cost_min, estimated_cost_max, confidence, trade, summary, vendors)",
    )
    .order("created_at", { ascending: false });

  if (requestsError) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Unable to load maintenance requests right now.
      </p>
    );
  }

  const requests: MaintenanceRequestRow[] = Array.isArray(requestRows)
    ? (requestRows as MaintenanceRequestRow[])
    : [];

  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const inProgressCount = requests.filter((request) => request.status === "in_progress").length;
  const completedCount = requests.filter((request) => request.status === "completed").length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-2">
        <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900">
          Landlord workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Maintenance inbox
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">{pendingCount}</p>
        </article>
        <article className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">In progress</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">{inProgressCount}</p>
        </article>
        <article className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Completed</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">{completedCount}</p>
        </article>
      </div>

      {requests.length === 0 ? (
        <p className="rounded-xl border border-zinc-900/10 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          No maintenance requests yet.
        </p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const urgencyLabel = isMaintenanceRequestUrgency(request.urgency)
              ? MAINTENANCE_REQUEST_URGENCY_LABELS[request.urgency]
              : request.urgency;

            const statusLabel = isMaintenanceRequestStatus(request.status)
              ? MAINTENANCE_REQUEST_STATUS_LABELS[request.status]
              : request.status;

            const tenant = Array.isArray(request.tenants) ? request.tenants[0] : null;
            const property =
              tenant?.property_id && propertyMap.has(tenant.property_id)
                ? propertyMap.get(tenant.property_id)
                : null;

            const review = Array.isArray(request.maintenance_request_reviews)
              ? request.maintenance_request_reviews[0]
              : request.maintenance_request_reviews;

            return (
              <article key={request.id} className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-950">{request.issue}</h2>
                    <p className="text-sm text-zinc-600">
                      {tenant?.name ?? "Unknown tenant"} - Unit {request.unit}
                    </p>
                    <p className="text-sm text-zinc-600">
                      {property ? `${property.name} - ${property.address}` : "Property unavailable"}
                    </p>
                    <p className="text-xs text-zinc-500">Submitted {formatDateTime(request.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-700">{urgencyLabel}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{statusLabel}</p>
                  </div>
                </div>

                {request.details ? <p className="mt-3 text-sm text-zinc-700">{request.details}</p> : null}

                <section className="mt-4 rounded-xl border border-emerald-900/10 bg-emerald-50/40 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-900">
                    AI review
                  </h3>

                  {review ? (
                    <div className="mt-2 space-y-2 text-sm text-zinc-700">
                      <p>
                        <span className="font-medium text-zinc-900">Estimated repair cost:</span>{" "}
                        {formatCost(review.estimated_cost_min, review.estimated_cost_max)}
                      </p>
                      <p>
                        <span className="font-medium text-zinc-900">Trade:</span> {review.trade}
                      </p>
                      <p>
                        <span className="font-medium text-zinc-900">Confidence:</span>{" "}
                        {Math.round(review.confidence * 100)}%
                      </p>
                      <p>{review.summary}</p>

                      <div className="pt-2">
                        <p className="font-medium text-zinc-900">Nearby maintenance contacts</p>
                        {Array.isArray(review.vendors) && review.vendors.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {review.vendors.slice(0, 3).map((vendor) => (
                              <li key={`${request.id}-${vendor.name}`} className="rounded-lg border border-zinc-900/10 bg-white px-3 py-2">
                                <p className="font-medium text-zinc-900">{vendor.name}</p>
                                <p className="text-xs text-zinc-600">
                                  {vendor.phone ?? "No phone listed"}
                                  {vendor.website ? ` - ${vendor.website}` : ""}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-zinc-600">No nearby contacts were returned yet.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-700">Review queued. AI estimate will appear shortly.</p>
                  )}
                </section>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LandlordMaintenanceRequestsFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}
