import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";

type JobStatus = "queued" | "processing" | "completed" | "failed";

type MaintenanceReviewJob = {
  id: string;
  maintenance_request_id: string;
  attempt_count: number;
};

type VendorContact = {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  rating: number | null;
  user_ratings_total: number | null;
};

export type CostEstimate = {
  trade: string;
  severity: "low" | "medium" | "high" | "critical";
  estimated_cost_min: number;
  estimated_cost_max: number;
  confidence: number;
  summary: string;
};

export type MaintenanceRequestContext = {
  id: string;
  issue: string;
  details: string | null;
  location: string | null;
  urgency: string;
  unit: string;
  contact_phone: string | null;
  created_at: string;
  tenant_name: string;
  tenant_phone: string | null;
  property_name: string;
  property_address: string;
};

const REVIEW_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_RETRIES = 3;
const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
};

export const getMaxRetries = (): number => {
  const configured = process.env.MAINTENANCE_REVIEW_MAX_RETRIES;

  if (!configured) {
    return DEFAULT_MAX_RETRIES;
  }

  const parsed = Number.parseInt(configured, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_RETRIES;
};

export const getDefaultBatchSize = (): number => {
  const configured = process.env.MAINTENANCE_REVIEW_BATCH_SIZE;

  if (!configured) {
    return DEFAULT_BATCH_SIZE;
  }

  const parsed = Number.parseInt(configured, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE;
};

export const normalizeConfidence = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return Number(value.toFixed(3));
};

export const sanitizeCostEstimate = (estimate: CostEstimate): CostEstimate => {
  const minimum = Math.max(0, Math.round(estimate.estimated_cost_min));
  const maximum = Math.max(minimum, Math.round(estimate.estimated_cost_max));

  return {
    ...estimate,
    estimated_cost_min: minimum,
    estimated_cost_max: maximum,
    confidence: normalizeConfidence(estimate.confidence),
  };
};

export const parseEstimateJson = (raw: string): CostEstimate => {
  const parsed = JSON.parse(raw) as Partial<CostEstimate>;

  if (
    typeof parsed.trade !== "string" ||
    typeof parsed.severity !== "string" ||
    typeof parsed.estimated_cost_min !== "number" ||
    typeof parsed.estimated_cost_max !== "number" ||
    typeof parsed.confidence !== "number" ||
    typeof parsed.summary !== "string"
  ) {
    throw new Error("Anthropic response did not match maintenance estimate schema");
  }

  if (!["low", "medium", "high", "critical"].includes(parsed.severity)) {
    throw new Error("Anthropic response severity was invalid");
  }

  return sanitizeCostEstimate(parsed as CostEstimate);
};

export const buildEstimatePrompt = (context: MaintenanceRequestContext): string => {
  return [
    "Estimate this maintenance request for a US residential property.",
    "Return JSON only with keys:",
    "trade (string)",
    "severity (one of: low, medium, high, critical)",
    "estimated_cost_min (number, USD)",
    "estimated_cost_max (number, USD)",
    "confidence (number 0-1)",
    "summary (string, <= 220 chars, plain language)",
    "Do not include markdown or additional keys.",
    "",
    `Issue title: ${context.issue}`,
    `Issue details: ${context.details ?? "Not provided"}`,
    `Location in unit: ${context.location ?? "Not provided"}`,
    `Urgency: ${context.urgency}`,
    `Unit: ${context.unit}`,
    `Property: ${context.property_name}`,
    `Address: ${context.property_address}`,
  ].join("\n");
};

export const buildPlacesQuery = (context: MaintenanceRequestContext, trade: string): string => {
  return `${trade} repair near ${context.property_address}`;
};

async function fetchMaintenanceRequestContext(
  maintenanceRequestId: string,
): Promise<MaintenanceRequestContext> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("maintenance_requests")
    .select(
      "id, issue, details, location, urgency, unit, contact_phone, created_at, tenants(name, phone, properties(name, address))",
    )
    .eq("id", maintenanceRequestId)
    .single();

  if (error || !data) {
    throw new Error(`Unable to load maintenance request ${maintenanceRequestId}`);
  }

  const tenantRelation = data.tenants;
  const tenant = Array.isArray(tenantRelation) ? tenantRelation[0] : tenantRelation;
  if (!tenant || typeof tenant.name !== "string") {
    throw new Error(`Missing tenant relation for maintenance request ${maintenanceRequestId}`);
  }

  const propertyRelation = tenant.properties;
  const property = Array.isArray(propertyRelation) ? propertyRelation[0] : propertyRelation;
  if (!property || typeof property.name !== "string" || typeof property.address !== "string") {
    throw new Error(`Missing property relation for maintenance request ${maintenanceRequestId}`);
  }

  return {
    id: data.id,
    issue: data.issue,
    details: data.details,
    location: data.location,
    urgency: data.urgency,
    unit: data.unit,
    contact_phone: data.contact_phone,
    created_at: data.created_at,
    tenant_name: tenant.name,
    tenant_phone: typeof tenant.phone === "string" ? tenant.phone : null,
    property_name: property.name,
    property_address: property.address,
  };
}

async function estimateCost(context: MaintenanceRequestContext): Promise<CostEstimate> {
  const anthropic = new Anthropic({ apiKey: getRequiredEnv("ANTHROPIC_API_KEY") });

  const response = await anthropic.messages.create({
    model: REVIEW_MODEL,
    max_tokens: 500,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: buildEstimatePrompt(context),
      },
    ],
  });

  const textBlock = response.content.find(
    (contentBlock: Anthropic.ContentBlock) => contentBlock.type === "text",
  );
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic returned no text content for maintenance estimate");
  }

  return parseEstimateJson(textBlock.text.trim());
}

async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<VendorContact | null> {
  const detailUrl = new URL(GOOGLE_PLACES_DETAILS_URL);
  detailUrl.searchParams.set("place_id", placeId);
  detailUrl.searchParams.set(
    "fields",
    "name,formatted_phone_number,website,formatted_address,rating,user_ratings_total,url",
  );
  detailUrl.searchParams.set("key", apiKey);

  const response = await fetch(detailUrl, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    status?: string;
    result?: {
      name?: string;
      formatted_phone_number?: string;
      website?: string;
      formatted_address?: string;
      url?: string;
      rating?: number;
      user_ratings_total?: number;
    };
  };

  if (payload.status !== "OK" || !payload.result?.name) {
    return null;
  }

  return {
    name: payload.result.name,
    phone: payload.result.formatted_phone_number ?? null,
    website: payload.result.website ?? null,
    address: payload.result.formatted_address ?? null,
    maps_url: payload.result.url ?? null,
    rating: typeof payload.result.rating === "number" ? payload.result.rating : null,
    user_ratings_total:
      typeof payload.result.user_ratings_total === "number"
        ? payload.result.user_ratings_total
        : null,
  };
}

async function findNearbyVendors(
  context: MaintenanceRequestContext,
  trade: string,
): Promise<VendorContact[]> {
  const apiKey = getRequiredEnv("GOOGLE_PLACES_API_KEY");
  const searchUrl = new URL(GOOGLE_PLACES_TEXT_SEARCH_URL);
  searchUrl.searchParams.set("query", buildPlacesQuery(context, trade));
  searchUrl.searchParams.set("key", apiKey);

  const response = await fetch(searchUrl, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Google Places search failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    status?: string;
    results?: Array<{ place_id?: string }>;
  };

  if (!Array.isArray(payload.results) || payload.results.length === 0) {
    return [];
  }

  const placeIds = payload.results
    .map((result) => (typeof result.place_id === "string" ? result.place_id : null))
    .filter((placeId): placeId is string => placeId !== null)
    .slice(0, 5);

  const details = await Promise.all(placeIds.map((placeId) => fetchPlaceDetails(placeId, apiKey)));
  return details.filter((vendor): vendor is VendorContact => vendor !== null);
}

async function saveReview(
  maintenanceRequestId: string,
  estimate: CostEstimate,
  vendors: VendorContact[],
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("maintenance_request_reviews").upsert(
    {
      maintenance_request_id: maintenanceRequestId,
      trade: estimate.trade,
      severity: estimate.severity,
      estimated_cost_min: estimate.estimated_cost_min,
      estimated_cost_max: estimate.estimated_cost_max,
      currency: "USD",
      confidence: estimate.confidence,
      summary: estimate.summary,
      vendors,
      model: REVIEW_MODEL,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "maintenance_request_id" },
  );

  if (error) {
    throw new Error(`Unable to save maintenance review: ${error.message}`);
  }
}

async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  updates: Record<string, string | number | null>,
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("maintenance_review_jobs")
    .update({ status, ...updates })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Unable to update maintenance review job ${jobId}`);
  }
}

async function failOrRetryJob(job: MaintenanceReviewJob, errorMessage: string): Promise<void> {
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

async function claimQueuedJobs(limit: number): Promise<MaintenanceReviewJob[]> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: queuedJobs, error } = await supabase
    .from("maintenance_review_jobs")
    .select("id, maintenance_request_id, attempt_count")
    .eq("status", "queued")
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !queuedJobs) {
    throw new Error("Unable to fetch queued maintenance review jobs");
  }

  const claimed: MaintenanceReviewJob[] = [];

  for (const queuedJob of queuedJobs) {
    const { data: claimedRows, error: claimError } = await supabase
      .from("maintenance_review_jobs")
      .update({ status: "processing", started_at: nowIso, last_error: null })
      .eq("id", queuedJob.id)
      .eq("status", "queued")
      .select("id, maintenance_request_id, attempt_count");

    if (claimError || !Array.isArray(claimedRows) || claimedRows.length === 0) {
      continue;
    }

    const [row] = claimedRows;
    if (!row) {
      continue;
    }

    claimed.push({
      id: row.id,
      maintenance_request_id: row.maintenance_request_id,
      attempt_count: row.attempt_count,
    });
  }

  return claimed;
}

export async function processQueuedMaintenanceReviews(batchSize?: number) {
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
      const requestContext = await fetchMaintenanceRequestContext(job.maintenance_request_id);
      const estimate = await estimateCost(requestContext);
      const vendors = await findNearbyVendors(requestContext, estimate.trade);

      await saveReview(job.maintenance_request_id, estimate, vendors);

      await updateJobStatus(job.id, "completed", {
        completed_at: new Date().toISOString(),
        last_error: null,
      });

      result.completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown maintenance review error";
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
