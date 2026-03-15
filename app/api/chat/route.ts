import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { triggerMaintenanceReviewProcessingInBackground } from "@/lib/maintenance-review-worker";
import { sendSms, buildLandlordSms } from "@/lib/twilio/sms";
import { withAITracking } from "@/lib/ai-metrics";
import { createLogger, withCorrelationId } from "@/lib/logger";
import { getCorrelationId, setCorrelationIdHeader } from "@/lib/correlation";
import {
  rateLimit,
  RATE_LIMIT_CONFIGS,
  shouldBypass,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const baseLogger = createLogger("chat-api");

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

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const logger = withCorrelationId(baseLogger, correlationId);

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: 20 messages per minute per user
    let rlHeaders: Record<string, string> = {};
    if (!shouldBypass(request.headers)) {
      const rlResult = await rateLimit(
        `chat:${user.id}`,
        RATE_LIMIT_CONFIGS.chat,
      );
      rlHeaders = rateLimitHeaders(rlResult, RATE_LIMIT_CONFIGS.chat);

      if (!rlResult.allowed) {
        return setCorrelationIdHeader(
          new NextResponse(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                ...rlHeaders,
              },
            },
          ),
          correlationId,
        );
      }
    }

    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Fetch tenant profile + property
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*, properties(*)")
      .eq("id", user.id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Tenant profile not found" },
        { status: 404 }
      );
    }

    const property = tenant.properties as typeof tenant.properties & {
      manager_phone: string | null;
    };
    const tenantWithPhone = tenant as typeof tenant & { phone: string | null };

    // Save user message
    await supabase.from("chat_messages").insert({
      tenant_id: user.id,
      role: "user",
      content: message,
      channel: "web",
    });

    // Load web conversation history only
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("tenant_id", user.id)
      .eq("channel", "web")
      .order("created_at", { ascending: true })
      .limit(50);

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
      { service: "chat", endpoint: "/api/chat", userId: user.id, correlationId },
      () =>
        anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        }),
    );

    const rawReply =
      response.content[0].type === "text" ? response.content[0].text : "";

    const { displayText, maintenanceRequests } = parseMaintenanceRequests(rawReply);

    // Insert all detected maintenance requests and notify landlord
    const insertedRequests = [];
    let triggeredMaintenanceProcessor = false;
    for (const mr of maintenanceRequests) {
      const { data: mrData, error: maintenanceInsertError } = await supabase
        .from("maintenance_requests")
        .insert({
          tenant_id: user.id,
          unit: tenant.unit,
          issue: mr.issue,
          urgency: mr.urgency,
          status: "pending",
        })
        .select()
        .single();
      if (mrData) insertedRequests.push(mrData);

      if (!maintenanceInsertError && !triggeredMaintenanceProcessor) {
        triggerMaintenanceReviewProcessingInBackground();
        triggeredMaintenanceProcessor = true;
      }

      if (property.manager_phone) {
        const landlordMsg = buildLandlordSms({
          propertyName: property.name,
          unit: tenant.unit,
          tenantName: tenant.name,
          tenantPhone: tenantWithPhone.phone ?? null,
          issue: mr.issue,
          urgency: mr.urgency,
        });
        await sendSms(property.manager_phone, landlordMsg).catch(
          (err) => logger.error({ err }, "Failed to SMS landlord")
        );
      }
    }

    // Save assistant message (display text only)
    await supabase.from("chat_messages").insert({
      tenant_id: user.id,
      role: "assistant",
      content: displayText,
      channel: "web",
    });

    const jsonResponse = NextResponse.json({
      reply: displayText,
      maintenanceRequests: insertedRequests,
    });
    for (const [k, v] of Object.entries(rlHeaders)) {
      jsonResponse.headers.set(k, v);
    }
    return setCorrelationIdHeader(jsonResponse, correlationId);
  } catch (error) {
    logger.error({ err: error }, "Chat API error");
    return setCorrelationIdHeader(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
      correlationId,
    );
  }
}
