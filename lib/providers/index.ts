import { zillowProvider } from './zillow';
import { apartmentsProvider } from './apartments';
import type { ListingProvider } from './types';

export const activeProviders: ListingProvider[] = [zillowProvider, apartmentsProvider];

export type { ListingProvider, PropertyListing, SubmitResult } from './types';
