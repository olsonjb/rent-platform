import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  screening: "Screening",
  approved: "AI Approved",
  denied: "AI Denied",
  landlord_approved: "Approved",
  landlord_denied: "Denied",
  withdrawn: "Withdrawn",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  screening: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  denied: "bg-rose-100 text-rose-800",
  landlord_approved: "bg-emerald-100 text-emerald-800",
  landlord_denied: "bg-rose-100 text-rose-800",
  withdrawn: "bg-zinc-100 text-zinc-600",
};

const formatDate = (value: string): string => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

export default async function LandlordApplicationsPage() {
  return (
    <Suspense fallback={<LandlordApplicationsFallback />}>
      <LandlordApplicationsContent />
    </Suspense>
  );
}

async function LandlordApplicationsContent() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/auth/login");

  const roles = getUserRolesFromClaims(claimsData.claims);
  if (!roles.includes("landlord")) redirect("/auth/login");

  const { data: applications, error } = await supabase
    .from("rental_applications")
    .select("id, full_name, email, status, ai_decision, created_at, property_id, properties(address, name, monthly_rent)")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Unable to load applications right now.
      </p>
    );
  }

  const items = applications ?? [];

  const pendingCount = items.filter((a) => a.status === "pending" || a.status === "screening").length;
  const approvedCount = items.filter((a) => a.status === "approved" || a.status === "landlord_approved").length;
  const deniedCount = items.filter((a) => a.status === "denied" || a.status === "landlord_denied").length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-2">
        <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900">
          Landlord workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Tenant applications
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Pending / Screening</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">{pendingCount}</p>
        </article>
        <article className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Approved</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">{approvedCount}</p>
        </article>
        <article className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Denied</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">{deniedCount}</p>
        </article>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-zinc-900/10 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          No applications yet.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((app) => {
            const property = Array.isArray(app.properties) ? app.properties[0] : app.properties;
            const aiDecision = app.ai_decision as Record<string, unknown> | null;
            const riskScore = typeof aiDecision?.risk_score === "number" ? aiDecision.risk_score : null;
            const incomeRatio = typeof aiDecision?.income_ratio === "number" ? aiDecision.income_ratio : null;

            return (
              <Link
                key={app.id}
                href={`/landlord/applications/${app.id}`}
                className="block rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm transition hover:border-zinc-900/20 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-950">{app.full_name}</h2>
                    <p className="text-sm text-zinc-600">{property?.name ?? property?.address ?? "Property"}</p>
                    <p className="text-xs text-zinc-500">Applied {formatDate(app.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[app.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {STATUS_LABELS[app.status] ?? app.status}
                    </span>
                    {riskScore !== null ? (
                      <span className="text-xs text-zinc-500">Risk: {riskScore}/100</span>
                    ) : null}
                    {incomeRatio !== null ? (
                      <span className="text-xs text-zinc-500">Income: {incomeRatio.toFixed(1)}x rent</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LandlordApplicationsFallback() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-100" />)}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}
