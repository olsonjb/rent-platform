-- Rental Applications & AI Screening Pipeline

-- Enum for application status
CREATE TYPE public.application_status AS ENUM (
  'pending', 'screening', 'approved', 'denied',
  'landlord_approved', 'landlord_denied', 'withdrawn'
);

-- Main rental applications table
CREATE TABLE IF NOT EXISTS public.rental_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  credit_score_range text CHECK (credit_score_range IN ('below_580','580_619','620_659','660_699','700_749','750_plus')),
  monthly_income numeric(10,2) NOT NULL,
  employer_name text,
  employment_duration_months integer,
  employment_type text CHECK (employment_type IN ('full_time','part_time','self_employed','retired','other')),
  years_renting integer NOT NULL DEFAULT 0,
  previous_evictions boolean NOT NULL DEFAULT false,
  references jsonb NOT NULL DEFAULT '[]'::jsonb,
  social_media_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.application_status NOT NULL DEFAULT 'pending',
  landlord_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Async screening job queue
CREATE TABLE IF NOT EXISTS public.application_screening_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.rental_applications(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id)
);

-- Indexes
CREATE INDEX idx_rental_applications_property ON public.rental_applications (property_id);
CREATE INDEX idx_rental_applications_applicant ON public.rental_applications (applicant_id);
CREATE INDEX idx_rental_applications_status ON public.rental_applications (status);
CREATE UNIQUE INDEX idx_rental_applications_unique_active
  ON public.rental_applications (applicant_id, property_id)
  WHERE status IN ('pending', 'screening', 'approved', 'denied');
CREATE INDEX idx_application_screening_jobs_status
  ON public.application_screening_jobs (status, next_attempt_at);

-- Enable RLS
ALTER TABLE public.rental_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_screening_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: Applicants can SELECT their own applications
CREATE POLICY "applicant select own applications"
  ON public.rental_applications FOR SELECT
  USING (applicant_id = auth.uid());

-- RLS: Applicants can INSERT their own applications
CREATE POLICY "applicant insert own applications"
  ON public.rental_applications FOR INSERT
  WITH CHECK (applicant_id = auth.uid());

-- RLS: Applicants can UPDATE own applications (withdraw only)
CREATE POLICY "applicant withdraw own applications"
  ON public.rental_applications FOR UPDATE
  USING (applicant_id = auth.uid())
  WITH CHECK (applicant_id = auth.uid() AND status = 'withdrawn');

-- RLS: Landlords can SELECT applications for their properties
CREATE POLICY "landlord select property applications"
  ON public.rental_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = rental_applications.property_id
        AND p.landlord_id = auth.uid()
    )
  );

-- RLS: Landlords can UPDATE applications for their properties (override decisions)
CREATE POLICY "landlord update property applications"
  ON public.rental_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = rental_applications.property_id
        AND p.landlord_id = auth.uid()
    )
  );

-- RLS: Service role full access (handled by default service role bypass)

-- Public SELECT on listings where status = 'active'
CREATE POLICY "public select active listings"
  ON public.listings FOR SELECT
  USING (status = 'active');

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.set_rental_applications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_application_screening_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_applications_set_updated_at ON public.rental_applications;
CREATE TRIGGER rental_applications_set_updated_at
BEFORE UPDATE ON public.rental_applications
FOR EACH ROW
EXECUTE FUNCTION public.set_rental_applications_updated_at();

DROP TRIGGER IF EXISTS application_screening_jobs_set_updated_at ON public.application_screening_jobs;
CREATE TRIGGER application_screening_jobs_set_updated_at
BEFORE UPDATE ON public.application_screening_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_application_screening_jobs_updated_at();

-- Auto-enqueue screening job on application insert
CREATE OR REPLACE FUNCTION public.enqueue_application_screening_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.application_screening_jobs (application_id)
  VALUES (NEW.id)
  ON CONFLICT (application_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_application_screening_job_on_insert ON public.rental_applications;
CREATE TRIGGER enqueue_application_screening_job_on_insert
AFTER INSERT ON public.rental_applications
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_application_screening_job();
