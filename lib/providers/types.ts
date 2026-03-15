export interface PropertyListing {
  title: string;
  description: string;
  highlights: string[];
  rent: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface SubmitResult {
  provider: string;
  success: boolean;
  listingUrl?: string;
  error?: string;
}

export interface ListingProvider {
  name: string;
  submit(listing: PropertyListing): Promise<SubmitResult>;
}
