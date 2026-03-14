-- Auto-listing agent schema additions

-- Add renewal_offered to leases
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS renewal_offered boolean NOT NULL DEFAULT false;

-- Add 'renewed' to lease_status enum (idempotent)
ALTER TYPE public.lease_status ADD VALUE IF NOT EXISTS 'renewed';

-- Add sqft to properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS sqft integer;

-- Create listing_status enum
DO $$ BEGIN
  CREATE TYPE public.listing_status AS ENUM ('pending', 'active', 'rejected', 'expired', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create listings table
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  status listing_status NOT NULL DEFAULT 'pending',
  ai_decision jsonb NOT NULL DEFAULT '{}',
  ai_content jsonb NOT NULL DEFAULT '{}',
  suggested_rent numeric,
  title text,
  description text,
  highlights text[],
  provider_results jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Updated_at trigger (reuse existing function if available)
DO $$ BEGIN
  CREATE TRIGGER set_listings_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Index for cron job: find active leases by end_date
CREATE INDEX IF NOT EXISTS idx_leases_active_end_date
  ON public.leases (end_date)
  WHERE status = 'active';

-- Index for listings by property
CREATE INDEX IF NOT EXISTS idx_listings_property_id
  ON public.listings (property_id);

-- RLS
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Landlords can view their own listings (via property ownership)
CREATE POLICY "Landlords can view own listings" ON public.listings
  FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE landlord_id = auth.uid()
    )
  );

-- Service role can do everything (for cron job / agent)
CREATE POLICY "Service role full access on listings" ON public.listings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Landlords can update their own listings (via property ownership)
CREATE POLICY "Landlords can update own listings" ON public.listings
  FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT id FROM public.properties WHERE landlord_id = auth.uid()
    )
  );

-- Prevent duplicate listings for the same lease (only one pending or active at a time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_unique_active_lease
  ON public.listings (lease_id)
  WHERE status IN ('pending', 'active');
