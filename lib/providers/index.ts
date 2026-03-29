import { zillowProvider } from './zillow';
import { apartmentsProvider } from './apartments';
import { craigslistProvider } from './craigslist';
import { rentlerProvider } from './rentler';
import type { ListingProvider } from './types';

export const activeProviders: ListingProvider[] = [zillowProvider, apartmentsProvider, craigslistProvider, rentlerProvider];

export type { ListingProvider, PropertyListing, SubmitResult } from './types';
