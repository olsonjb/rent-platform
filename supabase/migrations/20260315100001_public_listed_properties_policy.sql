-- Allow any user to read properties that have active listings.
-- Uses a SECURITY DEFINER function to avoid infinite recursion:
-- the listings table has RLS policies that reference properties,
-- so a direct subquery would create a circular dependency.

CREATE OR REPLACE FUNCTION public.property_has_active_listing(prop_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings WHERE property_id = prop_id AND status = 'active'
  );
$$;

CREATE POLICY "public select listed properties"
  ON public.properties FOR SELECT
  USING (public.property_has_active_listing(id));
