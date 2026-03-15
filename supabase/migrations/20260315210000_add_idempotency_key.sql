-- Add idempotency key to maintenance_requests to prevent duplicate submissions
-- Key is a hash of (tenant_id + normalized_issue_text + date)
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Index for efficient duplicate lookups within a time window
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_idempotency
  ON maintenance_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
