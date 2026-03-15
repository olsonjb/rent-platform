-- Screening Audit Log — append-only table for Fair Housing compliance

CREATE TABLE IF NOT EXISTS public.screening_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.rental_applications(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'submitted', 'screening_started', 'ai_decision',
    'landlord_override', 'final_decision'
  )),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_screening_audit_log_application
  ON public.screening_audit_log (application_id);
CREATE INDEX idx_screening_audit_log_event_type
  ON public.screening_audit_log (event_type);
CREATE INDEX idx_screening_audit_log_created_at
  ON public.screening_audit_log (created_at);

-- Enable RLS
ALTER TABLE public.screening_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Landlords can SELECT audit logs for their properties
CREATE POLICY "landlord select screening audit logs"
  ON public.screening_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rental_applications ra
      JOIN public.properties p ON p.id = ra.property_id
      WHERE ra.id = screening_audit_log.application_id
        AND p.landlord_id = auth.uid()
    )
  );

-- Append-only: prevent UPDATE on screening_audit_log
CREATE OR REPLACE FUNCTION public.prevent_screening_audit_log_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'screening_audit_log is append-only: UPDATE not allowed';
END;
$$;

CREATE TRIGGER screening_audit_log_prevent_update
BEFORE UPDATE ON public.screening_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.prevent_screening_audit_log_update();

-- Append-only: prevent DELETE on screening_audit_log
CREATE OR REPLACE FUNCTION public.prevent_screening_audit_log_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'screening_audit_log is append-only: DELETE not allowed';
END;
$$;

CREATE TRIGGER screening_audit_log_prevent_delete
BEFORE DELETE ON public.screening_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.prevent_screening_audit_log_delete();
