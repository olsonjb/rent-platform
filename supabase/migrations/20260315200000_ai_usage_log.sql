-- AI usage tracking table for observability and cost monitoring
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  total_tokens integer NOT NULL,
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL,
  service text NOT NULL,
  endpoint text,
  correlation_id text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (no policies = only service_role can access)
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Indexes for querying usage data
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_service ON ai_usage_log (service);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_correlation_id ON ai_usage_log (correlation_id);
