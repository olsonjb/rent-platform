import type { ListingProvider, PropertyListing, SubmitResult } from './types';

const MOCK_FAILURE_RATE = parseFloat(process.env.MOCK_FAILURE_RATE ?? '0');

export const ZillowProvider: ListingProvider = {
  name: 'zillow',

  async submit(listing: PropertyListing): Promise<SubmitResult> {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 200));

    if (Math.random() < MOCK_FAILURE_RATE) {
      return {
        success: false,
        error: 'Zillow API: simulated failure',
        submitted_at: new Date().toISOString(),
      };
    }

    const externalId = `zillow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const slug = listing.address.toLowerCase().replace(/\s+/g, '-');

    return {
      success: true,
      external_id: externalId,
      url: `https://www.zillow.com/rental-manager/properties/${slug}-${externalId}`,
      submitted_at: new Date().toISOString(),
    };
  },
};
