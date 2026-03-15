-- Screening Metrics — stores computed disparate impact metrics

CREATE TABLE IF NOT EXISTS public.screening_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('credit_score_range', 'income_bracket')),
  category text NOT NULL,
  total_applications integer NOT NULL DEFAULT 0,
  approved_count integer NOT NULL DEFAULT 0,
  denied_count integer NOT NULL DEFAULT 0,
  approval_rate numeric(5,4),
  deviation_from_overall numeric(5,4),
  flagged boolean NOT NULL DEFAULT false,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_screening_metrics_landlord
  ON public.screening_metrics (landlord_id);
CREATE INDEX idx_screening_metrics_type
  ON public.screening_metrics (metric_type);
CREATE INDEX idx_screening_metrics_computed_at
  ON public.screening_metrics (computed_at);

-- Enable RLS
ALTER TABLE public.screening_metrics ENABLE ROW LEVEL SECURITY;

-- RLS: Landlords can SELECT their own metrics
CREATE POLICY "landlord select own screening metrics"
  ON public.screening_metrics FOR SELECT
  USING (landlord_id = auth.uid());
