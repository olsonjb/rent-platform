-- Allow any authenticated user to read properties that have active listings
-- This enables renters to browse listings and see property details
CREATE POLICY "public select listed properties"
  ON public.properties FOR SELECT
  USING (
    id IN (
      SELECT property_id FROM public.listings WHERE status = 'active'
    )
  );
