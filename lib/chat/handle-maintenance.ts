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
 * Insert maintenance requests into the database and notify the landlord via SMS.
 *
 * Shared between the web chat route and the SMS route so that both use
 * identical insertion + notification logic.
 */
export async function handleMaintenanceRequests(
  requests: MaintenanceRequest[],
  ctx: HandleMaintenanceContext
): Promise<InsertedMaintenanceRequest[]> {
  const inserted: InsertedMaintenanceRequest[] = [];
  let triggeredProcessor = false;

  for (const mr of requests) {
    const { data: mrData, error: insertError } = await ctx.supabase
      .from("maintenance_requests")
      .insert({
        tenant_id: ctx.tenantId,
        unit: ctx.unit,
        issue: mr.issue,
        urgency: mr.urgency,
        status: "pending",
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
