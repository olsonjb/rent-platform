import type { ListingProvider, PropertyListing, SubmitResult } from './types';

const FAILURE_RATE = parseFloat(process.env.MOCK_FAILURE_RATE ?? '0.1');

export const rentlerProvider: ListingProvider = {
  name: 'Rentler',
  async submit(listing: PropertyListing): Promise<SubmitResult> {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 600));

    if (Math.random() < FAILURE_RATE) {
      return { provider: 'Rentler', success: false, error: 'Rentler API error (mock)' };
    }

    const slug = listing.address.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      provider: 'Rentler',
      success: true,
      listingUrl: `https://www.rentler.com/listings/${slug}-${Date.now()}`,
    };
  },
};
