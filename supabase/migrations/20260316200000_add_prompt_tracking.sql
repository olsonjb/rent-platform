-- Add prompt name and version tracking to ai_usage_log
ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS prompt_name text;
ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS prompt_version text;

-- Index for querying by prompt name (A/B testing, usage analysis)
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_prompt_name ON ai_usage_log (prompt_name);
