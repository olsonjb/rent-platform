import type { ListingProvider, PropertyListing, SubmitResult } from './types';

const FAILURE_RATE = parseFloat(process.env.MOCK_FAILURE_RATE ?? '0.1');

export const zillowProvider: ListingProvider = {
  name: 'Zillow',
  async submit(listing: PropertyListing): Promise<SubmitResult> {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));

    if (Math.random() < FAILURE_RATE) {
      return { provider: 'Zillow', success: false, error: 'Zillow API timeout (mock)' };
    }

    const slug = listing.address.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      provider: 'Zillow',
      success: true,
      listingUrl: `https://www.zillow.com/rental/${slug}-${Date.now()}/`,
    };
  },
};
