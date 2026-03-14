import type { ListingProvider } from './types';
import { ZillowProvider } from './zillow';
import { ApartmentsProvider } from './apartments';

export const activeProviders: ListingProvider[] = [
  ZillowProvider,
  ApartmentsProvider,
];
