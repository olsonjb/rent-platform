import { createServiceClient } from "@/lib/supabase/service";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { triggerMaintenanceReviewProcessingInBackground } from "@/lib/maintenance-review-worker";
import { sendSms, normalizeFromForLookup, buildLandlordSms } from "@/lib/twilio/sms";
import { withAITracking } from "@/lib/ai-metrics";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const anthropic = new Anthropic();

interface MaintenanceRequest {
  issue: string;
  urgency: "habitability" | "standard";
}

function parseMaintenanceRequests(
  text: string
): { displayText: string; maintenanceRequests: MaintenanceRequest[] } {
  const delimiter = "|||MAINTENANCE_REQUEST|||";
  const endDelimiter = "|||END|||";

  const firstIdx = text.indexOf(delimiter);
  if (firstIdx === -1) return { displayText: text.trim(), maintenanceRequests: [] };

  const displayText = text.slice(0, firstIdx).trim();
  const requests: MaintenanceRequest[] = [];

  let searchFrom = 0;
  while (true) {
    const start = text.indexOf(delimiter, searchFrom);
    if (start === -1) break;
    const jsonStart = start + delimiter.length;
    const end = text.indexOf(endDelimiter, jsonStart);
    if (end === -1) break;
    const jsonStr = text.slice(jsonStart, end).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.issue && parsed.urgency) {
        requests.push(parsed as MaintenanceRequest);
      }
    } catch {
      // ignore malformed block
    }
    searchFrom = end + endDelimiter.length;
  }

  return { displayText, maintenanceRequests: requests };
}

function twimlReply(message: string): NextResponse {
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  twiml.message(message);
  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;

  if (!from || !body) {
    return twimlReply("Sorry, we couldn't process your message.");
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

  // Load SMS conversation history only
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("tenant_id", tenant.id)
    .eq("channel", "sms")
    .order("created_at", { ascending: true })
    .limit(30);

  const messages: Anthropic.MessageParam[] = (history ?? []).map(
    (msg: { role: string; content: string }) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })
  );

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
    { service: "sms", endpoint: "/api/sms", userId: tenant.id },
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
  let triggeredMaintenanceProcessor = false;
  for (const mr of maintenanceRequests) {
    const { error: maintenanceInsertError } = await supabase.from("maintenance_requests").insert({
      tenant_id: tenant.id,
      unit: tenant.unit,
      issue: mr.issue,
      urgency: mr.urgency,
      status: "pending",
    });

    if (!maintenanceInsertError && !triggeredMaintenanceProcessor) {
      triggerMaintenanceReviewProcessingInBackground();
      triggeredMaintenanceProcessor = true;
    }

    if (property.manager_phone) {
      const landlordMsg = buildLandlordSms({
        propertyName: property.name,
        unit: tenant.unit,
        tenantName: tenant.name,
        tenantPhone: tenant.phone ?? null,
        issue: mr.issue,
        urgency: mr.urgency,
      });
      await sendSms(property.manager_phone, landlordMsg).catch((err) =>
        console.error("Failed to SMS landlord:", err)
      );
    }
  }

  // Save assistant reply
  await supabase.from("chat_messages").insert({
    tenant_id: tenant.id,
    role: "assistant",
    content: displayText,
    channel: "sms",
  });

  return twimlReply(displayText);
}
