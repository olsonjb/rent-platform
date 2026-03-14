import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitApplication } from "@/app/actions/applications";

type ApplyPageProps = {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function ApplyPage({ params, searchParams }: ApplyPageProps) {
  return (
    <Suspense fallback={<ApplyFallback />}>
      <ApplyContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ApplyContent({ params, searchParams }: ApplyPageProps) {
  const { listingId } = await params;
  const resolvedSearchParams = await searchParams;
  const errorMessage = resolvedSearchParams.error;

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, title, suggested_rent, property_id, properties(id, address, city, state, monthly_rent, name)")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) redirect("/listings");

  const property = Array.isArray(listing.properties) ? listing.properties[0] : listing.properties;
  const rent = listing.suggested_rent ?? property?.monthly_rent ?? 0;

  const userEmail = user.email ?? "";
  const userFullName = (() => {
    if (typeof user.user_metadata === "object" && user.user_metadata !== null) {
      const meta = user.user_metadata as Record<string, unknown>;
      if (typeof meta.full_name === "string") return meta.full_name;
      if (typeof meta.name === "string") return meta.name;
    }
    return "";
  })();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link
          href={`/listings/${listingId}`}
          className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:bg-zinc-100"
        >
          Back to listing
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Apply for rental
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
          {listing.title ?? property?.address ?? "Property"} — ${rent.toLocaleString()}/mo
        </p>
      </div>

      <form className="space-y-6 rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm" action={submitApplication}>
        <input type="hidden" name="propertyId" value={property?.id ?? ""} />
        <input type="hidden" name="listingId" value={listingId} />

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-medium text-zinc-900">Full name</label>
            <input
              id="fullName" name="fullName" type="text" required
              defaultValue={userFullName}
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-zinc-900">Email</label>
            <input
              id="email" name="email" type="email" required
              defaultValue={userEmail}
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium text-zinc-900">Phone (optional)</label>
          <input
            id="phone" name="phone" type="tel"
            placeholder="(555) 123-4567"
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="creditScoreRange" className="text-sm font-medium text-zinc-900">Credit score range</label>
            <select
              id="creditScoreRange" name="creditScoreRange" required defaultValue=""
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            >
              <option value="" disabled>Select range</option>
              <option value="below_580">Below 580</option>
              <option value="580_619">580 - 619</option>
              <option value="620_659">620 - 659</option>
              <option value="660_699">660 - 699</option>
              <option value="700_749">700 - 749</option>
              <option value="750_plus">750+</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="monthlyIncome" className="text-sm font-medium text-zinc-900">Monthly income ($)</label>
            <input
              id="monthlyIncome" name="monthlyIncome" type="number" required min="0" step="0.01"
              placeholder="5000.00"
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="employerName" className="text-sm font-medium text-zinc-900">Employer (optional)</label>
            <input
              id="employerName" name="employerName" type="text"
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="employmentDuration" className="text-sm font-medium text-zinc-900">Employment (months)</label>
            <input
              id="employmentDuration" name="employmentDuration" type="number" min="0"
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="employmentType" className="text-sm font-medium text-zinc-900">Employment type</label>
            <select
              id="employmentType" name="employmentType" defaultValue=""
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            >
              <option value="">Select type</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="self_employed">Self-employed</option>
              <option value="retired">Retired</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="yearsRenting" className="text-sm font-medium text-zinc-900">Years renting</label>
            <input
              id="yearsRenting" name="yearsRenting" type="number" min="0" defaultValue="0"
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-900">Previous evictions?</legend>
            <div className="flex gap-4 text-sm text-zinc-700">
              <label className="flex items-center gap-2">
                <input type="radio" name="previousEvictions" value="no" defaultChecked required />
                No
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="previousEvictions" value="yes" />
                Yes
              </label>
            </div>
          </fieldset>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-900">References (up to 3)</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-3">
              <input name={`refName${i}`} type="text" placeholder="Name" className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900" />
              <input name={`refPhone${i}`} type="tel" placeholder="Phone" className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900" />
              <input name={`refRelationship${i}`} type="text" placeholder="Relationship" className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900" />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-900">Social media links (optional)</p>
          {[0, 1, 2].map((i) => (
            <input key={i} name={`socialMedia${i}`} type="url" placeholder="https://..." className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900" />
          ))}
        </div>

        <button
          type="submit"
          className="inline-flex rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Submit application
        </button>

        {errorMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function ApplyFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}
