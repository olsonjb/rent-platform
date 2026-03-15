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

export type RentInvoiceStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'overdue';

export interface RentInvoice {
  id: string;
  lease_id: string;
  tenant_id: string;
  landlord_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  status: RentInvoiceStatus;
  due_date: string;
  stripe_payment_intent_id: string | null;
  created_at: string;
  paid_at: string | null;
}

export type RenewalOfferStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export type RenewalRecommendation = 'renew-adjust' | 'renew-same' | 'do-not-renew';

export interface RenewalEvaluation {
  recommendation: RenewalRecommendation;
  suggested_rent: number;
  reasoning: string;
  tenant_score: number;
  factors: {
    payment_history: string;
    maintenance_requests: string;
    tenure_length: string;
    communication: string;
  };
}

export interface RenewalOffer {
  id: string;
  lease_id: string;
  tenant_id: string;
  landlord_id: string;
  new_monthly_rent: number;
  new_end_date: string;
  offer_letter: string | null;
  status: RenewalOfferStatus;
  ai_recommendation: string | null;
  ai_reasoning: string | null;
  suggested_rent_adjustment: number | null;
  sent_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenewalOfferWithRelations extends RenewalOffer {
  leases: {
    monthly_rent: number;
    start_date: string;
    end_date: string;
    property_id: string;
    properties: {
      address: string;
      city: string | null;
      state: string | null;
    };
  };
  landlord_tenants: {
    name: string;
    email: string;
  };
}

export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExtractedLeaseData {
  tenant_names: string[];
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  monthly_rent: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  security_deposit: number | null;
  pet_policy: string | null;
  parking_policy: string | null;
  quiet_hours: string | null;
  late_fee_terms: string | null;
  early_termination_terms: string | null;
  contact_info: {
    name: string | null;
    phone: string | null;
    email: string | null;
  };
}

export interface LeaseDocument {
  id: string;
  landlord_id: string;
  property_id: string | null;
  file_url: string;
  file_name: string;
  extraction_status: ExtractionStatus;
  extracted_data: ExtractedLeaseData | null;
  created_at: string;
}

export type ExtractionJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DocumentExtractionJob {
  id: string;
  document_id: string;
  status: ExtractionJobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
}
