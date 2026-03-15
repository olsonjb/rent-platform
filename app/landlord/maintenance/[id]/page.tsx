import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";
import {
  MAINTENANCE_REQUEST_STATUS_LABELS,
  MAINTENANCE_REQUEST_URGENCY_LABELS,
  isMaintenanceRequestStatus,
  isMaintenanceRequestUrgency,
} from "@/lib/maintenance-requests";
import { VendorQuotesSection } from "./vendor-quotes";

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
    rating: number | null;
  }>;
};

type VendorOutreachRow = {
  id: string;
  vendor_name: string;
  vendor_phone: string | null;
  outreach_method: string;
  status: string;
  quote_amount_cents: number | null;
  quote_details: string | null;
  vendor_availability: string | null;
  sent_at: string;
  responded_at: string | null;
};

type MaintenanceRequestDetail = {
  id: string;
  issue: string;
  details: string | null;
  urgency: string;
  status: string;
  unit: string;
  created_at: string;
  tenants:
    | { name: string; property_id: string | null }
    | Array<{ name: string; property_id: string | null }>
    | null;
  maintenance_request_reviews: MaintenanceReview[] | MaintenanceReview | null;
  vendor_outreach: VendorOutreachRow[] | null;
};

type PropertyRow = {
  id: string;
  name: string;
  address: string;
};

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const formatCost = (minimum: number, maximum: number): string => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return `${formatter.format(minimum)} - ${formatter.format(maximum)}`;
};

const formatCents = (cents: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);

export default async function MaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<DetailFallback />}>
      <MaintenanceDetailContent id={id} />
    </Suspense>
  );
}

async function MaintenanceDetailContent({ id }: { id: string }) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/auth/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/auth/login");

  const roles = getUserRolesFromClaims(claimsData.claims);
  if (!roles.includes("landlord")) redirect("/auth/login");

  const { data: request, error: requestError } = await supabase
    .from("maintenance_requests")
    .select(
      "id, issue, details, urgency, status, unit, created_at, tenants(name, property_id), maintenance_request_reviews(estimated_cost_min, estimated_cost_max, confidence, trade, summary, vendors), vendor_outreach(id, vendor_name, vendor_phone, outreach_method, status, quote_amount_cents, quote_details, vendor_availability, sent_at, responded_at)",
    )
    .eq("id", id)
    .single();

  if (requestError || !request) {
    notFound();
  }

  const mr = request as unknown as MaintenanceRequestDetail;

  const tenant = Array.isArray(mr.tenants) ? mr.tenants[0] ?? null : mr.tenants;

  // Load property info
  let property: PropertyRow | null = null;
  if (tenant?.property_id) {
    const { data: propData } = await supabase
      .from("properties")
      .select("id, name, address")
      .eq("id", tenant.property_id)
      .single();
    property = propData as PropertyRow | null;
  }

  const review = Array.isArray(mr.maintenance_request_reviews)
    ? mr.maintenance_request_reviews[0]
    : mr.maintenance_request_reviews;

  const outreach = Array.isArray(mr.vendor_outreach) ? mr.vendor_outreach : [];

  const urgencyLabel = isMaintenanceRequestUrgency(mr.urgency)
    ? MAINTENANCE_REQUEST_URGENCY_LABELS[mr.urgency]
    : mr.urgency;

  const statusLabel = isMaintenanceRequestStatus(mr.status)
    ? MAINTENANCE_REQUEST_STATUS_LABELS[mr.status]
    : mr.status;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-1">
        <a
          href="/landlord/maintenance-requests"
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          &larr; Back to inbox
        </a>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
          {mr.issue}
        </h1>
        <p className="text-sm text-zinc-600">
          {tenant?.name ?? "Unknown tenant"} &middot; Unit {mr.unit}
          {property ? ` &middot; ${property.name}` : ""}
        </p>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
          {statusLabel}
        </span>
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
          {urgencyLabel}
        </span>
        <span className="text-xs text-zinc-500">
          Submitted {formatDateTime(mr.created_at)}
        </span>
      </div>

      {mr.details && (
        <p className="rounded-xl border border-zinc-900/10 bg-white p-4 text-sm text-zinc-700 shadow-sm">
          {mr.details}
        </p>
      )}

      {/* AI Review */}
      {review && (
        <section className="rounded-2xl border border-emerald-900/10 bg-emerald-50/40 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-900">
            AI Review
          </h2>
          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            <p>
              <span className="font-medium text-zinc-900">Estimated cost:</span>{" "}
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
          </div>
        </section>
      )}

      {/* Vendor quotes */}
      <VendorQuotesSection
        outreach={outreach}
        maintenanceRequestId={mr.id}
        formatCents={formatCents}
        formatDateTime={formatDateTime}
      />
    </div>
  );
}

function DetailFallback() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="h-8 w-64 animate-pulse rounded bg-zinc-200" />
      <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
      <div className="h-60 animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}
