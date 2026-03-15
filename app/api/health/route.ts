import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createLogger, withCorrelationId } from "@/lib/logger";
import { getCorrelationId } from "@/lib/correlation";

const baseLogger = createLogger("health");

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const logger = withCorrelationId(baseLogger, correlationId);
  const checks: Record<string, "ok" | "error"> = {
    supabase: "error",
  };

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("properties")
      .select("id")
      .limit(1);

    checks.supabase = error ? "error" : "ok";
  } catch (err) {
    logger.error({ err }, "Health check: Supabase unreachable");
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok");

  if (!allHealthy) {
    logger.warn({ checks }, "Health check degraded");
    return apiError("degraded", 503, correlationId, "HEALTH_DEGRADED");
  }

  return apiSuccess(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      checks,
    },
    correlationId,
  );
}
