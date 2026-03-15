import { createServiceClient } from "@/lib/supabase/service";
import { dispatchVendors } from "@/lib/agent/vendor-dispatch";
import type { VendorContact } from "@/lib/agent/vendor-dispatch";
import { createLogger } from "@/lib/logger";

const logger = createLogger("vendor-dispatch-processor");

type JobStatus = "queued" | "processing" | "completed" | "failed";

type VendorDispatchJob = {
  id: string;
  maintenance_request_id: string;
  attempt_count: number;
};

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_RETRIES = 3;

const getMaxRetries = (): number => {
  const configured = process.env.VENDOR_DISPATCH_MAX_RETRIES;
  if (!configured) return DEFAULT_MAX_RETRIES;
  const parsed = Number.parseInt(configured, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_RETRIES;
};

const getDefaultBatchSize = (): number => {
  const configured = process.env.VENDOR_DISPATCH_BATCH_SIZE;
  if (!configured) return DEFAULT_BATCH_SIZE;
  const parsed = Number.parseInt(configured, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE;
};

async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  updates: Record<string, string | number | null>,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("vendor_dispatch_jobs")
    .update({ status, ...updates })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Unable to update vendor dispatch job ${jobId}`);
  }
}

async function failOrRetryJob(job: VendorDispatchJob, errorMessage: string): Promise<boolean> {
  const nextAttemptCount = job.attempt_count + 1;
  const maxRetries = getMaxRetries();

  if (nextAttemptCount >= maxRetries) {
    await updateJobStatus(job.id, "failed", {
      attempt_count: nextAttemptCount,
      completed_at: new Date().toISOString(),
      last_error: errorMessage,
    });
    return false; // failed permanently
  }

  const backoffMinutes = Math.min(30, 2 ** nextAttemptCount);
  const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

  await updateJobStatus(job.id, "queued", {
    attempt_count: nextAttemptCount,
    next_attempt_at: nextAttemptAt,
    started_at: null,
    last_error: errorMessage,
  });
  return true; // requeued
}

async function claimQueuedJobs(limit: number): Promise<VendorDispatchJob[]> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: queuedJobs, error } = await supabase
    .from("vendor_dispatch_jobs")
    .select("id, maintenance_request_id, attempt_count")
    .eq("status", "queued")
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !queuedJobs) {
    throw new Error("Unable to fetch queued vendor dispatch jobs");
  }

  const claimed: VendorDispatchJob[] = [];

  for (const queuedJob of queuedJobs) {
    const { data: claimedRows, error: claimError } = await supabase
      .from("vendor_dispatch_jobs")
      .update({ status: "processing", started_at: nowIso, last_error: null })
      .eq("id", queuedJob.id)
      .eq("status", "queued")
      .select("id, maintenance_request_id, attempt_count");

    if (claimError || !Array.isArray(claimedRows) || claimedRows.length === 0) {
      continue;
    }

    const [row] = claimedRows;
    if (!row) continue;

    claimed.push({
      id: row.id,
      maintenance_request_id: row.maintenance_request_id,
      attempt_count: row.attempt_count,
    });
  }

  return claimed;
}

async function fetchDispatchContext(maintenanceRequestId: string) {
  const supabase = createServiceClient();

  // Get the maintenance request with tenant/property info
  const { data: mr, error: mrError } = await supabase
    .from("maintenance_requests")
    .select("id, issue, unit, tenants(name, phone, properties(name, address))")
    .eq("id", maintenanceRequestId)
    .single();

  if (mrError || !mr) {
    throw new Error(`Unable to load maintenance request ${maintenanceRequestId}`);
  }

  // Get the review with vendor list
  const { data: review, error: reviewError } = await supabase
    .from("maintenance_request_reviews")
    .select("trade, estimated_cost_min, estimated_cost_max, vendors")
    .eq("maintenance_request_id", maintenanceRequestId)
    .single();

  if (reviewError || !review) {
    throw new Error(`No review found for maintenance request ${maintenanceRequestId}`);
  }

  const tenantRelation = mr.tenants;
  const tenant = Array.isArray(tenantRelation) ? tenantRelation[0] : tenantRelation;
  if (!tenant) {
    throw new Error(`Missing tenant for maintenance request ${maintenanceRequestId}`);
  }

  const propertyRelation = tenant.properties;
  const property = Array.isArray(propertyRelation) ? propertyRelation[0] : propertyRelation;
  if (!property) {
    throw new Error(`Missing property for maintenance request ${maintenanceRequestId}`);
  }

  const vendors = (Array.isArray(review.vendors) ? review.vendors : []) as VendorContact[];

  return {
    maintenanceRequestId,
    issue: mr.issue,
    propertyAddress: property.address,
    propertyName: property.name,
    unit: mr.unit,
    trade: review.trade,
    estimatedCostMin: review.estimated_cost_min,
    estimatedCostMax: review.estimated_cost_max,
    vendors,
  };
}

export async function processQueuedVendorDispatches(batchSize?: number) {
  const resolvedBatchSize = batchSize && batchSize > 0 ? batchSize : getDefaultBatchSize();
  const claimedJobs = await claimQueuedJobs(resolvedBatchSize);

  const result = {
    claimed: claimedJobs.length,
    completed: 0,
    failed: 0,
    requeued: 0,
  };

  for (const job of claimedJobs) {
    try {
      const ctx = await fetchDispatchContext(job.maintenance_request_id);
      const contacted = await dispatchVendors(ctx);

      logger.info(
        { jobId: job.id, maintenanceRequestId: job.maintenance_request_id, contacted },
        "Vendor dispatch completed",
      );

      await updateJobStatus(job.id, "completed", {
        completed_at: new Date().toISOString(),
        last_error: null,
      });

      result.completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown vendor dispatch error";
      logger.error(
        { err: error, jobId: job.id, maintenanceRequestId: job.maintenance_request_id },
        "Vendor dispatch failed",
      );

      const requeued = await failOrRetryJob(job, message);
      if (requeued) {
        result.requeued += 1;
      } else {
        result.failed += 1;
      }
    }
  }

  return result;
}
