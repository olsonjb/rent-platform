export type LeaseStatus = 'active' | 'pending' | 'expired' | 'terminated';

export interface Property {
  id: string;
  landlord_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  created_at: string;
}

export interface Tenant {
  id: string;
  landlord_id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
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
  created_at: string;
}

export interface LeaseWithRelations extends Lease {
  properties: {
    address: string;
    city: string;
    state: string;
  };
  tenants: {
    name: string;
    email: string;
  };
}
