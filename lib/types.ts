export type LeaseStatus = 'active' | 'pending' | 'expired' | 'terminated' | 'renewed';

export interface Property {
  id: string;
  name: string;
  address: string;
  rent_due_day?: number;
  parking_policy?: string | null;
  pet_policy?: string | null;
  quiet_hours?: string | null;
  lease_terms?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  landlord_id?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  monthly_rent?: number | null;
  sqft?: number | null;
  created_at: string;
}

export interface LandlordTenant {
  id: string;
  landlord_id: string;
  name: string;
  email: string;
  phone: string | null;
  auth_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lease {
  id: string;
  landlord_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: LeaseStatus;
  renewal_offered: boolean;
  created_at: string;
  updated_at: string;
}

export type ListingStatus = 'pending' | 'active' | 'rejected' | 'expired' | 'error';

export interface AIDecision {
  should_list: boolean;
  reasoning: string;
  suggested_rent: number | null;
  urgency: 'high' | 'medium' | 'low';
}

export interface AIContent {
  title: string;
  description: string;
  highlights: string[];
}

export interface Listing {
  id: string;
  property_id: string;
  lease_id: string;
  status: ListingStatus;
  ai_decision: AIDecision;
  ai_content: AIContent;
  suggested_rent: number | null;
  title: string | null;
  description: string | null;
  highlights: string[] | null;
  provider_results: { provider: string; success: boolean; listingUrl?: string; error?: string }[];
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus = 'pending' | 'screening' | 'ai_reviewed' | 'approved' | 'denied' | 'landlord_approved' | 'landlord_denied' | 'withdrawn';

export interface ScreeningDecision {
  approved: boolean;
  reasoning: string;
  risk_score: number;
  income_ratio: number;
  flags: string[];
  confidence: number;
  social_media_notes: string | null;
}

export interface RentalApplication {
  id: string;
  listing_id: string | null;
  property_id: string;
  applicant_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  credit_score_range: string;
  monthly_income: number;
  employer_name: string | null;
  employment_duration_months: number | null;
  employment_type: string | null;
  years_renting: number;
  previous_evictions: boolean;
  references: { name: string; phone: string; relationship: string }[];
  social_media_links: string[];
  ai_decision: ScreeningDecision;
  status: ApplicationStatus;
  ai_recommendation: string | null;
  ai_recommendation_confidence: number | null;
  adverse_action_notice: string | null;
  landlord_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaseWithRelations extends Lease {
  properties: {
    address: string;
    city: string | null;
    state: string | null;
  };
  landlord_tenants: {
    name: string;
    email: string;
  };
}
