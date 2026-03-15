-- Listing provider submission log for health dashboard
CREATE TABLE IF NOT EXISTS public.listing_provider_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  response_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by listing
CREATE INDEX IF NOT EXISTS idx_listing_provider_log_listing_id
  ON public.listing_provider_log (listing_id);

-- Index for querying by provider + status (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_listing_provider_log_provider_status
  ON public.listing_provider_log (provider, status);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_listing_provider_log_created_at
  ON public.listing_provider_log (created_at);

-- RLS
ALTER TABLE public.listing_provider_log ENABLE ROW LEVEL SECURITY;

-- Landlords can view logs for their own listings
CREATE POLICY "Landlords can view own provider logs" ON public.listing_provider_log
  FOR SELECT
  USING (
    listing_id IN (
      SELECT l.id FROM public.listings l
      JOIN public.properties p ON l.property_id = p.id
      WHERE p.landlord_id = auth.uid()
    )
  );

-- Service role full access (for agent logging)
CREATE POLICY "Service role full access on listing_provider_log" ON public.listing_provider_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
