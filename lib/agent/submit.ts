import type { AIContent } from '@/lib/types';
import type { PropertyListing, SubmitResult } from '@/lib/providers/types';
import { activeProviders } from '@/lib/providers';
import type { Property } from '@/lib/types';

export async function submitToProviders(
  property: Property,
  content: AIContent
): Promise<Record<string, SubmitResult>> {
  const listing: PropertyListing = {
    title: content.title,
    description: content.description,
    asking_price: content.asking_price,
    available_date: content.available_date,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    sqft: property.sqft,
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
  };

  const results = await Promise.allSettled(
    activeProviders.map((p) => p.submit(listing).then((r) => ({ name: p.name, result: r })))
  );

  const providerResults: Record<string, SubmitResult> = {};
  results.forEach((r, i) => {
    const provider = activeProviders[i];
    if (r.status === 'fulfilled') {
      providerResults[r.value.name] = r.value.result;
    } else {
      providerResults[provider.name] = {
        success: false,
        error: r.reason?.message ?? 'Unknown error',
        submitted_at: new Date().toISOString(),
      };
    }
  });

  return providerResults;
}
