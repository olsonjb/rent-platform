import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withdrawApplication } from "@/app/actions/applications";

type ApplicationsPageProps = {
  searchParams: Promise<{ success?: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  screening: "Screening",
  approved: "Approved",
  denied: "Denied",
  landlord_approved: "Approved by Landlord",
  landlord_denied: "Denied by Landlord",
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

export default async function RenterApplicationsPage({ searchParams }: ApplicationsPageProps) {
  return (
    <Suspense fallback={<ApplicationsFallback />}>
      <ApplicationsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ApplicationsContent({ searchParams }: ApplicationsPageProps) {
  const resolvedSearchParams = await searchParams;
  const hasSuccess = resolvedSearchParams.success === "1";

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data: applications, error } = await supabase
    .from("rental_applications")
    .select("id, full_name, status, ai_decision, created_at, property_id, properties(address, name, monthly_rent)")
    .eq("applicant_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Unable to load applications right now.
      </p>
    );
  }

  const items = applications ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/renter/dashboard"
          className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:bg-zinc-100"
        >
          Back to dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          My applications
        </h1>
      </div>

      {hasSuccess ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Application submitted. AI screening is in progress.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-zinc-900/10 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-zinc-600">No applications yet.</p>
          <Link
            href="/listings"
            className="mt-3 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((app) => {
            const property = Array.isArray(app.properties) ? app.properties[0] : app.properties;
            const aiDecision = app.ai_decision as Record<string, unknown> | null;
            const canWithdraw = app.status === "pending" || app.status === "screening";

            return (
              <article key={app.id} className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
                      {property?.name ?? property?.address ?? "Property"}
                    </h2>
                    <p className="text-sm text-zinc-600">{property?.address ?? ""}</p>
                    <p className="text-xs text-zinc-500">Applied {formatDate(app.created_at)}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[app.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                    {STATUS_LABELS[app.status] ?? app.status}
                  </span>
                </div>

                {aiDecision && typeof aiDecision.reasoning === "string" ? (
                  <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">AI Screening Result</p>
                    <p className="mt-1">{aiDecision.reasoning as string}</p>
                    {typeof aiDecision.risk_score === "number" ? (
                      <p className="mt-1 text-xs text-zinc-500">Risk score: {aiDecision.risk_score as number}/100</p>
                    ) : null}
                  </div>
                ) : null}

                {canWithdraw ? (
                  <form className="mt-3" action={async () => { "use server"; await withdrawApplication(app.id); }}>
                    <button
                      type="submit"
                      className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                    >
                      Withdraw
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ApplicationsFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}
