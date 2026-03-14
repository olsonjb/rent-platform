import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export default async function ListingsPage() {
  return (
    <Suspense fallback={<ListingsFallback />}>
      <ListingsContent />
    </Suspense>
  );
}

async function ListingsContent() {
  const supabase = await createClient();

  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, title, description, highlights, suggested_rent, status, properties(id, address, city, state, zip, bedrooms, bathrooms, monthly_rent, sqft)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Unable to load listings right now.
        </p>
      </div>
    );
  }

  const activeListings = listings ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <p className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-900">
          Available rentals
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Browse listings
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
          Find your next home. Browse available rental properties and apply online.
        </p>
      </div>

      {activeListings.length === 0 ? (
        <p className="rounded-xl border border-zinc-900/10 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          No listings available right now. Check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeListings.map((listing) => {
            const property = Array.isArray(listing.properties) ? listing.properties[0] : listing.properties;
            const rent = listing.suggested_rent ?? property?.monthly_rent ?? 0;
            const highlights = Array.isArray(listing.highlights) ? listing.highlights : [];

            return (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="group rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm transition hover:border-zinc-900/20 hover:shadow-md"
              >
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950 group-hover:text-zinc-700">
                  {listing.title ?? property?.address ?? "Rental Property"}
                </h2>
                {property ? (
                  <p className="mt-1 text-sm text-zinc-600">
                    {property.address}{property.city ? `, ${property.city}` : ""}{property.state ? `, ${property.state}` : ""} {property.zip ?? ""}
                  </p>
                ) : null}
                <p className="mt-2 text-xl font-semibold text-zinc-950">
                  ${rent.toLocaleString()}<span className="text-sm font-normal text-zinc-500">/mo</span>
                </p>
                {property ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                    {property.bedrooms != null ? <span>{property.bedrooms} bed</span> : null}
                    {property.bathrooms != null ? <span>{property.bathrooms} bath</span> : null}
                    {property.sqft != null ? <span>{property.sqft.toLocaleString()} sqft</span> : null}
                  </div>
                ) : null}
                {highlights.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {highlights.slice(0, 3).map((highlight) => (
                      <span key={highlight} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {highlight}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListingsFallback() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
