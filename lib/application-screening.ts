import { createServiceClient } from "@/lib/supabase/service";
import { screenApplication } from "@/lib/agent/screening-agent";
import { logScreeningEvent } from "@/lib/screening/audit-log";

type JobStatus = "queued" | "processing" | "completed" | "failed";

type ScreeningJob = {
  id: string;
  application_id: string;
  attempt_count: number;
};

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_RETRIES = 3;

const getMaxRetries = (): number => {
  const configured = process.env.APPLICATION_SCREENING_MAX_RETRIES;
  if (!configured) return DEFAULT_MAX_RETRIES;
  const parsed = Number.parseInt(configured, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_RETRIES;
};

const getDefaultBatchSize = (): number => {
  const configured = process.env.APPLICATION_SCREENING_BATCH_SIZE;
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
    .from("application_screening_jobs")
    .update({ status, ...updates })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Unable to update application screening job ${jobId}`);
  }
}

async function failOrRetryJob(job: ScreeningJob, errorMessage: string): Promise<void> {
  const nextAttemptCount = job.attempt_count + 1;
  const maxRetries = getMaxRetries();

  if (nextAttemptCount >= maxRetries) {
    await updateJobStatus(job.id, "failed", {
      attempt_count: nextAttemptCount,
      completed_at: new Date().toISOString(),
      last_error: errorMessage,
    });
    return;
  }

  const backoffMinutes = Math.min(30, 2 ** nextAttemptCount);
  const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

  await updateJobStatus(job.id, "queued", {
    attempt_count: nextAttemptCount,
    next_attempt_at: nextAttemptAt,
    started_at: null,
    last_error: errorMessage,
  });
}

async function claimQueuedJobs(limit: number): Promise<ScreeningJob[]> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: queuedJobs, error } = await supabase
    .from("application_screening_jobs")
    .select("id, application_id, attempt_count")
    .eq("status", "queued")
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !queuedJobs) {
    throw new Error("Unable to fetch queued application screening jobs");
  }

  const claimed: ScreeningJob[] = [];

  for (const queuedJob of queuedJobs) {
    const { data: claimedRows, error: claimError } = await supabase
      .from("application_screening_jobs")
      .update({ status: "processing", started_at: nowIso, last_error: null })
      .eq("id", queuedJob.id)
      .eq("status", "queued")
      .select("id, application_id, attempt_count");

    if (claimError || !Array.isArray(claimedRows) || claimedRows.length === 0) {
      continue;
    }

    const [row] = claimedRows;
    if (!row) continue;

    claimed.push({
      id: row.id,
      application_id: row.application_id,
      attempt_count: row.attempt_count,
    });
  }

  return claimed;
}

async function fetchApplicationContext(applicationId: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("rental_applications")
    .select("*, properties(address, monthly_rent)")
    .eq("id", applicationId)
    .single();

  if (error || !data) {
    throw new Error(`Unable to load rental application ${applicationId}`);
  }

  const propertyRelation = data.properties;
  const property = Array.isArray(propertyRelation) ? propertyRelation[0] : propertyRelation;

  if (!property || typeof property.address !== "string") {
    throw new Error(`Missing property relation for application ${applicationId}`);
  }

  return {
    application: {
      id: data.id as string,
      full_name: data.full_name as string,
      credit_score_range: data.credit_score_range as string,
      monthly_income: Number(data.monthly_income),
      employer_name: data.employer_name as string | null,
      employment_duration_months: data.employment_duration_months as number | null,
      employment_type: data.employment_type as string | null,
      years_renting: data.years_renting as number,
      previous_evictions: data.previous_evictions as boolean,
      references: (data.references ?? []) as { name: string; phone: string; relationship: string }[],
      social_media_links: (data.social_media_links ?? []) as string[],
    },
    property: {
      address: property.address as string,
      monthly_rent: Number(property.monthly_rent ?? 0),
    },
  };
}

async function saveScreeningResult(applicationId: string, decision: Record<string, unknown>): Promise<void> {
  const supabase = createServiceClient();

  const aiRecommendation = (decision as { approved?: boolean }).approved ? "approved" : "denied";
  const aiConfidence = typeof (decision as { confidence?: number }).confidence === "number"
    ? Math.max(0, Math.min(1, (decision as { confidence: number }).confidence))
    : null;

  const { error } = await supabase
    .from("rental_applications")
    .update({
      ai_decision: decision,
      status: "ai_reviewed",
      ai_recommendation: aiRecommendation,
      ai_recommendation_confidence: aiConfidence,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) {
    throw new Error(`Unable to save screening result for application ${applicationId}: ${error.message}`);
  }

  await logScreeningEvent(applicationId, "ai_decision", {
    recommendation: aiRecommendation,
    confidence: aiConfidence,
    flags: (decision as { flags?: string[] }).flags ?? [],
  });
}

export async function processQueuedApplicationScreenings(batchSize?: number) {
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
      const context = await fetchApplicationContext(job.application_id);

      // Update status to screening
      const supabase = createServiceClient();
      await supabase
        .from("rental_applications")
        .update({ status: "screening" })
        .eq("id", job.application_id);

      await logScreeningEvent(job.application_id, "screening_started", {});

      const decision = await screenApplication(context);
      await saveScreeningResult(job.application_id, decision as unknown as Record<string, unknown>);

      await updateJobStatus(job.id, "completed", {
        completed_at: new Date().toISOString(),
        last_error: null,
      });

      result.completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown screening error";
      await failOrRetryJob(job, message);

      if (job.attempt_count + 1 >= getMaxRetries()) {
        result.failed += 1;
      } else {
        result.requeued += 1;
      }
    }
  }

  return result;
}
