import { zillowProvider } from './zillow';
import { apartmentsProvider } from './apartments';
import { craigslistProvider } from './craigslist';
import { webhookProvider } from './webhook';
import type { ListingProvider } from './types';

const providerRegistry: Record<string, ListingProvider> = {
  zillow: zillowProvider,
  apartments: apartmentsProvider,
  craigslist: craigslistProvider,
  webhook: webhookProvider,
};

const DEFAULT_PROVIDERS = 'zillow,apartments';

export function getActiveProviders(): ListingProvider[] {
  const envValue = process.env.ACTIVE_LISTING_PROVIDERS ?? DEFAULT_PROVIDERS;
  const names = envValue
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const providers: ListingProvider[] = [];
  for (const name of names) {
    const provider = providerRegistry[name];
    if (provider) {
      providers.push(provider);
    } else {
      console.warn(`[listing-providers] Unknown provider: ${name}`);
    }
  }

  return providers;
}

export type { ListingProvider, PropertyListing, SubmitResult } from './types';
