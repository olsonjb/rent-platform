import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { parseMaintenanceRequests } from "@/lib/chat/parse-maintenance";
import { triggerMaintenanceReviewProcessingInBackground } from "@/lib/maintenance-review-worker";
import { sendSms, buildLandlordSms } from "@/lib/twilio/sms";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const anthropic = new Anthropic();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let message: string;
    try {
      const body = await request.json();
      message = body.message;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

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
          (err) => console.error("Failed to SMS landlord:", err)
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

    return NextResponse.json({
      reply: displayText,
      maintenanceRequests: insertedRequests,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
