import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { parseMaintenanceRequests } from "@/lib/chat/parse-maintenance";
import { handleMaintenanceRequests } from "@/lib/chat/handle-maintenance";
import { getConversationHistory } from "@/lib/chat/history";
import { withAITracking } from "@/lib/ai-metrics";
import { createLogger, withCorrelationId } from "@/lib/logger";
import { getCorrelationId, setCorrelationIdHeader } from "@/lib/correlation";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const baseLogger = createLogger("chat-api");

const anthropic = new Anthropic();

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

    // Load web conversation history (windowed)
    const messages = await getConversationHistory(supabase, user.id, "web");

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
    const insertedRequests = await handleMaintenanceRequests(
      maintenanceRequests,
      {
        supabase,
        tenantId: user.id,
        unit: tenant.unit,
        tenantName: tenant.name,
        tenantPhone: tenantWithPhone.phone ?? null,
        propertyName: property.name,
        managerPhone: property.manager_phone,
        logger,
      }
    );

    // Save assistant message (display text only)
    await supabase.from("chat_messages").insert({
      tenant_id: user.id,
      role: "assistant",
      content: displayText,
      channel: "web",
    });

    return setCorrelationIdHeader(
      NextResponse.json({
        reply: displayText,
        maintenanceRequests: insertedRequests,
      }),
      correlationId,
    );
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
