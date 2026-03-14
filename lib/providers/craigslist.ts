import type { ListingProvider, PropertyListing, SubmitResult } from './types';

const FAILURE_RATE = parseFloat(process.env.MOCK_FAILURE_RATE ?? '0.1');

export const craigslistProvider: ListingProvider = {
  name: 'Craigslist',
  async submit(listing: PropertyListing): Promise<SubmitResult> {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 800));

    if (Math.random() < FAILURE_RATE) {
      return { provider: 'Craigslist', success: false, error: 'Craigslist posting failed (mock)' };
    }

    return {
      provider: 'Craigslist',
      success: true,
      listingUrl: `https://www.craigslist.org/apa/${Date.now()}`,
    };
  },
};
