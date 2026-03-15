import { createServiceClient } from "@/lib/supabase/service";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { parseMaintenanceRequests } from "@/lib/chat/parse-maintenance";
import { handleMaintenanceRequests } from "@/lib/chat/handle-maintenance";
import { getConversationHistory } from "@/lib/chat/history";
import { sendSms, normalizeFromForLookup, buildLandlordSms } from "@/lib/twilio/sms";
import { validateTwilioWebhook } from "@/lib/twilio/validate";
import { withAITracking } from "@/lib/ai-metrics";
import { createLogger, withCorrelationId } from "@/lib/logger";
import { getCorrelationId } from "@/lib/correlation";
import {
  rateLimit,
  RATE_LIMIT_CONFIGS,
  shouldBypass,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const baseLogger = createLogger("sms-api");

const anthropic = new Anthropic();

function twimlReply(message: string, correlationId?: string): NextResponse {
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  twiml.message(message);
  const headers: Record<string, string> = { "Content-Type": "text/xml" };
  if (correlationId) {
    headers["x-correlation-id"] = correlationId;
  }
  return new NextResponse(twiml.toString(), { headers });
}

export async function POST(request: NextRequest) {
  // Validate Twilio signature BEFORE any business logic
  const validationError = await validateTwilioWebhook(request);
  if (validationError) {
    return validationError;
  }

  const correlationId = getCorrelationId(request);
  const logger = withCorrelationId(baseLogger, correlationId);

  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;

  if (!from || !body) {
    return twimlReply("Sorry, we couldn't process your message.");
  }

  // Rate limiting: 10 messages per minute per phone number
  if (!shouldBypass(request.headers)) {
    const rlResult = await rateLimit(
      `sms:${from}`,
      RATE_LIMIT_CONFIGS.sms,
    );

    if (!rlResult.allowed) {
      const rlHeaders = rateLimitHeaders(rlResult, RATE_LIMIT_CONFIGS.sms);
      const MessagingResponse = twilio.twiml.MessagingResponse;
      const twiml = new MessagingResponse();
      twiml.message("You're sending messages too quickly. Please wait a moment and try again.");
      const headers: Record<string, string> = {
        "Content-Type": "text/xml",
        ...rlHeaders,
      };
      if (correlationId) {
        headers["x-correlation-id"] = correlationId;
      }
      return new NextResponse(twiml.toString(), { status: 429, headers });
    }
  }

  const supabase = createServiceClient();
  const normalizedPhone = normalizeFromForLookup(from);

  // Look up tenant by phone number
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("*, properties(*)")
    .eq("phone", normalizedPhone)
    .single();

  if (tenantError || !tenant) {
    return twimlReply(
      "We couldn't find an account linked to this number. Please contact your property manager."
    );
  }

  const property = tenant.properties;

  // Save inbound message
  await supabase.from("chat_messages").insert({
    tenant_id: tenant.id,
    role: "user",
    content: body,
    channel: "sms",
  });

  // Load SMS conversation history (windowed)
  const messages = await getConversationHistory(supabase, tenant.id, "sms");

  // Call Claude
  const systemPrompt = buildSystemPrompt({
    propertyName: property.name,
    propertyAddress: property.address,
    tenantName: tenant.name,
    unit: tenant.unit,
    rentDueDay: property.rent_due_day,
    parkingPolicy: property.parking_policy,
    petPolicy: property.pet_policy,
    quietHours: property.quiet_hours,
    leaseTerms: property.lease_terms,
    managerName: property.manager_name,
    managerPhone: property.manager_phone,
  });

  const response = await withAITracking(
    { service: "sms", endpoint: "/api/sms", userId: tenant.id, correlationId },
    () =>
      anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 320, // keep SMS replies concise
        system: systemPrompt,
        messages,
      }),
  );

  const rawReply =
    response.content[0].type === "text" ? response.content[0].text : "";

  const { displayText, maintenanceRequests } = parseMaintenanceRequests(rawReply);

  // Insert all detected maintenance requests and notify landlord
  await handleMaintenanceRequests(maintenanceRequests, {
    supabase,
    tenantId: tenant.id,
    unit: tenant.unit,
    tenantName: tenant.name,
    tenantPhone: tenant.phone ?? null,
    propertyName: property.name,
    managerPhone: property.manager_phone,
    logger,
  });

  // Save assistant reply
  await supabase.from("chat_messages").insert({
    tenant_id: tenant.id,
    role: "assistant",
    content: displayText,
    channel: "sms",
  });

  return twimlReply(displayText, correlationId);
}
