import { activeProviders } from '@/lib/providers';
import type { PropertyListing, SubmitResult } from '@/lib/providers';

export async function submitToProviders(listing: PropertyListing): Promise<SubmitResult[]> {
  const results: SubmitResult[] = [];

  for (let i = 0; i < activeProviders.length; i++) {
    const provider = activeProviders[i];
    try {
      const result = await provider.submit(listing);
      results.push(result);
    } catch (error) {
      results.push({
        provider: provider.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
