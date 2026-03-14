import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  return (
    <Suspense fallback={<ListingDetailFallback />}>
      <ListingDetailContent params={params} />
    </Suspense>
  );
}

async function ListingDetailContent({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, title, description, highlights, suggested_rent, status, property_id, properties(id, address, city, state, zip, bedrooms, bathrooms, monthly_rent, sqft, name)")
    .eq("id", id)
    .eq("status", "active")
    .single();

  if (error || !listing) {
    redirect("/listings");
  }

  const property = Array.isArray(listing.properties) ? listing.properties[0] : listing.properties;
  const rent = listing.suggested_rent ?? property?.monthly_rent ?? 0;
  const highlights = Array.isArray(listing.highlights) ? listing.highlights : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/listings"
        className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:bg-zinc-100"
      >
        Back to listings
      </Link>

      <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          {listing.title ?? property?.address ?? "Rental Property"}
        </h1>
        {property ? (
          <p className="mt-1 text-sm text-zinc-600">
            {property.address}{property.city ? `, ${property.city}` : ""}{property.state ? `, ${property.state}` : ""} {property.zip ?? ""}
          </p>
        ) : null}

        <p className="mt-4 text-3xl font-semibold text-zinc-950">
          ${rent.toLocaleString()}<span className="text-base font-normal text-zinc-500">/mo</span>
        </p>

        {property ? (
          <div className="mt-4 grid grid-cols-3 gap-4 rounded-xl bg-zinc-50 p-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Bedrooms</p>
              <p className="mt-1 text-lg font-semibold text-zinc-950">{property.bedrooms ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Bathrooms</p>
              <p className="mt-1 text-lg font-semibold text-zinc-950">{property.bathrooms ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Sqft</p>
              <p className="mt-1 text-lg font-semibold text-zinc-950">{property.sqft?.toLocaleString() ?? "—"}</p>
            </div>
          </div>
        ) : null}

        {listing.description ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">Description</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">{listing.description}</p>
          </div>
        ) : null}

        {highlights.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">Highlights</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {highlights.map((highlight: string) => (
                <span key={highlight} className="rounded-full bg-sky-50 px-3 py-1 text-sm text-sky-800">
                  {highlight}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <Link
            href={`/renter/applications/${listing.id}/apply`}
            className="inline-flex rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Apply now
          </Link>
        </div>
      </div>
    </div>
  );
}

function ListingDetailFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="h-6 w-32 animate-pulse rounded bg-zinc-200" />
      <div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}
