-- Renewal offers table for T14 lease renewal workflow

-- Create renewal_offer_status enum
DO $$ BEGIN
  CREATE TYPE public.renewal_offer_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create renewal_offers table
CREATE TABLE IF NOT EXISTS public.renewal_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.landlord_tenants(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_monthly_rent numeric(10,2) NOT NULL,
  new_end_date date NOT NULL,
  offer_letter text,
  status renewal_offer_status NOT NULL DEFAULT 'pending',
  ai_recommendation text,
  ai_reasoning text,
  suggested_rent_adjustment numeric(10,2),
  sent_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER set_renewal_offers_updated_at
    BEFORE UPDATE ON public.renewal_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_renewal_offers_lease_id
  ON public.renewal_offers (lease_id);

CREATE INDEX IF NOT EXISTS idx_renewal_offers_tenant_id
  ON public.renewal_offers (tenant_id);

CREATE INDEX IF NOT EXISTS idx_renewal_offers_landlord_id
  ON public.renewal_offers (landlord_id);

CREATE INDEX IF NOT EXISTS idx_renewal_offers_status
  ON public.renewal_offers (status)
  WHERE status = 'pending';

-- Prevent duplicate pending offers for the same lease
CREATE UNIQUE INDEX IF NOT EXISTS idx_renewal_offers_unique_pending_lease
  ON public.renewal_offers (lease_id)
  WHERE status = 'pending';

-- RLS
ALTER TABLE public.renewal_offers ENABLE ROW LEVEL SECURITY;

-- Landlords can view their own renewal offers
CREATE POLICY "Landlords can view own renewal offers" ON public.renewal_offers
  FOR SELECT
  USING (auth.uid() = landlord_id);

-- Landlords can update their own renewal offers
CREATE POLICY "Landlords can update own renewal offers" ON public.renewal_offers
  FOR UPDATE
  USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);

-- Service role full access (for cron job / agent)
CREATE POLICY "Service role full access on renewal_offers" ON public.renewal_offers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Tenants can view offers sent to them (via auth_user_id link)
CREATE POLICY "Tenants can view own renewal offers" ON public.renewal_offers
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM public.landlord_tenants WHERE auth_user_id = auth.uid()
    )
  );

-- Tenants can update their own offers (accept/decline)
CREATE POLICY "Tenants can respond to own renewal offers" ON public.renewal_offers
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT id FROM public.landlord_tenants WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.landlord_tenants WHERE auth_user_id = auth.uid()
    )
  );
