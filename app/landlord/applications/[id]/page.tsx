import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";
import { overrideApplicationDecision } from "@/app/actions/landlord-applications";

type ApplicationDetailPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  screening: "Screening",
  approved: "AI Approved",
  denied: "AI Denied",
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

const CREDIT_LABELS: Record<string, string> = {
  below_580: "Below 580",
  "580_619": "580 - 619",
  "620_659": "620 - 659",
  "660_699": "660 - 699",
  "700_749": "700 - 749",
  "750_plus": "750+",
};

const formatDate = (value: string): string => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

export default async function LandlordApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  return (
    <Suspense fallback={<DetailFallback />}>
      <DetailContent params={params} />
    </Suspense>
  );
}

async function DetailContent({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/auth/login");

  const roles = getUserRolesFromClaims(claimsData.claims);
  if (!roles.includes("landlord")) redirect("/auth/login");

  const { data: app, error } = await supabase
    .from("rental_applications")
    .select("*, properties(address, name, monthly_rent)")
    .eq("id", id)
    .single();

  if (error || !app) redirect("/landlord/applications");

  const property = Array.isArray(app.properties) ? app.properties[0] : app.properties;
  const aiDecision = (app.ai_decision ?? {}) as Record<string, unknown>;
  const hasAiDecision = typeof aiDecision.reasoning === "string";
  const flags = Array.isArray(aiDecision.flags) ? (aiDecision.flags as string[]) : [];
  const references = Array.isArray(app.references) ? (app.references as { name: string; phone: string; relationship: string }[]) : [];
  const canOverride = !["landlord_approved", "landlord_denied", "withdrawn"].includes(app.status);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/landlord/applications"
        className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:bg-zinc-100"
      >
        Back to applications
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{app.full_name}</h1>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[app.status] ?? "bg-zinc-100 text-zinc-600"}`}>
          {STATUS_LABELS[app.status] ?? app.status}
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">Applicant Details</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="font-medium text-zinc-900">Email:</span> {app.email}</div>
          <div><span className="font-medium text-zinc-900">Phone:</span> {app.phone ?? "Not provided"}</div>
          <div><span className="font-medium text-zinc-900">Credit Score:</span> {CREDIT_LABELS[app.credit_score_range] ?? app.credit_score_range}</div>
          <div><span className="font-medium text-zinc-900">Monthly Income:</span> ${Number(app.monthly_income).toLocaleString()}</div>
          <div><span className="font-medium text-zinc-900">Employer:</span> {app.employer_name ?? "Not provided"}</div>
          <div><span className="font-medium text-zinc-900">Employment Duration:</span> {app.employment_duration_months != null ? `${app.employment_duration_months} months` : "Not provided"}</div>
          <div><span className="font-medium text-zinc-900">Employment Type:</span> {app.employment_type ?? "Not provided"}</div>
          <div><span className="font-medium text-zinc-900">Years Renting:</span> {app.years_renting}</div>
          <div><span className="font-medium text-zinc-900">Previous Evictions:</span> {app.previous_evictions ? "Yes" : "No"}</div>
        </div>

        <div><span className="font-medium text-zinc-900">Property:</span> {property?.name ?? property?.address ?? "Unknown"} — ${Number(property?.monthly_rent ?? 0).toLocaleString()}/mo</div>
        <p className="text-xs text-zinc-500 mt-1">Applied {formatDate(app.created_at)}</p>

        {references.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-zinc-900">References</h3>
            <div className="mt-2 space-y-1 text-sm text-zinc-700">
              {references.map((ref, i) => (
                <p key={i}>{ref.name} ({ref.relationship}) — {ref.phone}</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/40 p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-900">AI Screening</h2>

        {hasAiDecision ? (
          <div className="mt-3 space-y-3 text-sm text-zinc-700">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Risk Score</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-950">{typeof aiDecision.risk_score === "number" ? aiDecision.risk_score : "—"}</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Income Ratio</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-950">{typeof aiDecision.income_ratio === "number" ? `${(aiDecision.income_ratio as number).toFixed(1)}x` : "—"}</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Confidence</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-950">{typeof aiDecision.confidence === "number" ? `${Math.round((aiDecision.confidence as number) * 100)}%` : "—"}</p>
              </div>
            </div>

            <p><span className="font-medium text-zinc-900">Recommendation:</span> {aiDecision.approved ? "Approve" : "Deny"}</p>
            <p>{aiDecision.reasoning as string}</p>

            {flags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {flags.map((flag) => (
                  <span key={flag} className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                    {flag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            ) : null}

            {typeof aiDecision.social_media_notes === "string" ? (
              <p><span className="font-medium text-zinc-900">Social Media Notes:</span> {aiDecision.social_media_notes}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-700">Screening in progress. AI decision will appear shortly.</p>
        )}
      </div>

      {canOverride ? (
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">Landlord Override</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={async (formData: FormData) => {
              "use server";
              const notes = formData.get("notes") as string | null;
              await overrideApplicationDecision(id, "landlord_approved", notes ?? undefined);
            }}>
              <input type="hidden" name="notes" value="" />
              <div className="space-y-2">
                <textarea name="notes" rows={2} placeholder="Optional notes..." className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900" />
                <button type="submit" className="inline-flex rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                  Approve
                </button>
              </div>
            </form>
            <form action={async (formData: FormData) => {
              "use server";
              const notes = formData.get("notes") as string | null;
              await overrideApplicationDecision(id, "landlord_denied", notes ?? undefined);
            }}>
              <input type="hidden" name="notes" value="" />
              <div className="space-y-2">
                <textarea name="notes" rows={2} placeholder="Denial reason..." className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900" />
                <button type="submit" className="inline-flex rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">
                  Deny
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {app.landlord_notes ? (
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">Landlord Notes</h2>
          <p className="mt-2 text-sm text-zinc-700">{app.landlord_notes}</p>
          {app.reviewed_at ? <p className="mt-1 text-xs text-zinc-500">Reviewed {formatDate(app.reviewed_at)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function DetailFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="h-6 w-32 animate-pulse rounded bg-zinc-200" />
      <div className="h-8 w-64 animate-pulse rounded bg-zinc-200" />
      <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
      <div className="h-48 animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}
