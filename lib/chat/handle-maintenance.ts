import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MaintenanceRequest } from "./parse-maintenance";
import type { Logger } from "@/lib/logger";
import { triggerMaintenanceReviewProcessingInBackground } from "@/lib/maintenance-review-worker";
import { sendSms, buildLandlordSms } from "@/lib/twilio/sms";

export interface HandleMaintenanceContext {
  supabase: SupabaseClient;
  tenantId: string;
  unit: string;
  tenantName: string;
  tenantPhone: string | null;
  propertyName: string;
  managerPhone: string | null;
  logger: Logger;
}

export interface InsertedMaintenanceRequest {
  id: string;
  tenant_id: string;
  unit: string;
  issue: string;
  urgency: string;
  status: string;
  [key: string]: unknown;
}

/**
 * Normalize issue text for idempotency key generation.
 * Lowercases, trims, and collapses whitespace.
 */
function normalizeIssueText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Generate an idempotency key for a maintenance request.
 * Key = sha256(tenant_id + normalized_issue + YYYY-MM-DD)
 */
export function generateIdempotencyKey(
  tenantId: string,
  issueText: string,
  date: Date = new Date()
): string {
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const normalized = normalizeIssueText(issueText);
  const input = `${tenantId}:${normalized}:${dateStr}`;
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Check whether a duplicate maintenance request exists within the last 24 hours.
 * Returns the existing request if found, null otherwise.
 */
async function findDuplicate(
  supabase: SupabaseClient,
  idempotencyKey: string
): Promise<InsertedMaintenanceRequest | null> {
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .gte("created_at", twentyFourHoursAgo)
    .limit(1)
    .maybeSingle();

  return (data as InsertedMaintenanceRequest) ?? null;
}

/**
 * Insert maintenance requests into the database and notify the landlord via SMS.
 *
 * Shared between the web chat route and the SMS route so that both use
 * identical insertion + notification logic.
 *
 * Duplicate requests (same tenant + normalized issue text + same calendar day)
 * within 24 hours are skipped and logged.
 */
export async function handleMaintenanceRequests(
  requests: MaintenanceRequest[],
  ctx: HandleMaintenanceContext
): Promise<InsertedMaintenanceRequest[]> {
  const inserted: InsertedMaintenanceRequest[] = [];
  let triggeredProcessor = false;

  for (const mr of requests) {
    const idempotencyKey = generateIdempotencyKey(ctx.tenantId, mr.issue);

    // Check for duplicate within 24 hours
    const existing = await findDuplicate(ctx.supabase, idempotencyKey);
    if (existing) {
      ctx.logger.info(
        { idempotencyKey, existingId: existing.id },
        "Duplicate maintenance request detected, skipping insertion"
      );
      inserted.push(existing);
      continue;
    }

    const { data: mrData, error: insertError } = await ctx.supabase
      .from("maintenance_requests")
      .insert({
        tenant_id: ctx.tenantId,
        unit: ctx.unit,
        issue: mr.issue,
        urgency: mr.urgency,
        status: "pending",
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (mrData) {
      inserted.push(mrData as InsertedMaintenanceRequest);
    }

    if (!insertError && !triggeredProcessor) {
      triggerMaintenanceReviewProcessingInBackground();
      triggeredProcessor = true;
    }

    if (ctx.managerPhone) {
      const landlordMsg = buildLandlordSms({
        propertyName: ctx.propertyName,
        unit: ctx.unit,
        tenantName: ctx.tenantName,
        tenantPhone: ctx.tenantPhone,
        issue: mr.issue,
        urgency: mr.urgency,
      });
      await sendSms(ctx.managerPhone, landlordMsg).catch((err) =>
        ctx.logger.error({ err }, "Failed to SMS landlord")
      );
    }
  }

  return inserted;
}
