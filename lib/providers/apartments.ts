import type { ListingProvider, PropertyListing, SubmitResult } from './types';

const FAILURE_RATE = parseFloat(process.env.MOCK_FAILURE_RATE ?? '0.1');

export const apartmentsProvider: ListingProvider = {
  name: 'Apartments.com',
  async submit(listing: PropertyListing): Promise<SubmitResult> {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 800));

    if (Math.random() < FAILURE_RATE) {
      return { provider: 'Apartments.com', success: false, error: 'Apartments.com rate limit (mock)' };
    }

    const id = Math.random().toString(36).substring(2, 10);
    return {
      provider: 'Apartments.com',
      success: true,
      listingUrl: `https://www.apartments.com/listing/${id}/`,
    };
  },
};
