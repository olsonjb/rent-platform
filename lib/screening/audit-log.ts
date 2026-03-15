import { createServiceClient } from "@/lib/supabase/service";

export type ScreeningEventType =
  | "submitted"
  | "screening_started"
  | "ai_decision"
  | "landlord_override"
  | "final_decision";

export interface ScreeningAuditEntry {
  id: string;
  application_id: string;
  event_type: ScreeningEventType;
  event_data: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

export async function logScreeningEvent(
  applicationId: string,
  eventType: ScreeningEventType,
  eventData: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("screening_audit_log").insert({
    application_id: applicationId,
    event_type: eventType,
    event_data: eventData,
    actor_id: actorId ?? null,
  });

  if (error) {
    throw new Error(
      `Failed to log screening event for application ${applicationId}: ${error.message}`,
    );
  }
}

export async function getApplicationAuditLog(
  applicationId: string,
): Promise<ScreeningAuditEntry[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("screening_audit_log")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to fetch audit log for application ${applicationId}: ${error.message}`,
    );
  }

  return (data ?? []) as ScreeningAuditEntry[];
}
