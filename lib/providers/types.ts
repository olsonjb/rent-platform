export interface PropertyListing {
  title: string;
  description: string;
  asking_price: number;
  available_date: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface SubmitResult {
  success: boolean;
  external_id?: string;
  url?: string;
  error?: string;
  submitted_at: string;
}

export interface ListingProvider {
  name: string;
  submit(listing: PropertyListing): Promise<SubmitResult>;
}
