import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { sendSms, toE164, buildLandlordSms } from "@/lib/twilio/sms";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic();

interface MaintenanceRequest {
  issue: string;
  urgency: "habitability" | "standard";
}

function parseMaintenanceRequest(
  text: string
): { displayText: string; maintenanceRequest: MaintenanceRequest | null } {
  const delimiter = "|||MAINTENANCE_REQUEST|||";
  const endDelimiter = "|||END|||";

  const startIdx = text.indexOf(delimiter);
  if (startIdx === -1) {
    return { displayText: text.trim(), maintenanceRequest: null };
  }

  const displayText = text.slice(0, startIdx).trim();
  const jsonStart = startIdx + delimiter.length;
  const jsonEnd = text.indexOf(endDelimiter, jsonStart);
  const jsonStr = text.slice(jsonStart, jsonEnd === -1 ? undefined : jsonEnd).trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.issue && parsed.urgency) {
      return { displayText, maintenanceRequest: parsed as MaintenanceRequest };
    }
  } catch {
    // Failed to parse, treat as no maintenance request
  }

  return { displayText, maintenanceRequest: null };
}

export async function POST(request: NextRequest) {
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
    });

    // Load conversation history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("tenant_id", user.id)
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

    const { displayText, maintenanceRequest } =
      parseMaintenanceRequest(rawReply);

    // If maintenance request detected, insert it and notify landlord via SMS
    let maintenanceRecord = null;
    if (maintenanceRequest) {
      const { data: mrData } = await supabase
        .from("maintenance_requests")
        .insert({
          tenant_id: user.id,
          unit: tenant.unit,
          issue: maintenanceRequest.issue,
          urgency: maintenanceRequest.urgency,
          status: "pending",
        })
        .select()
        .single();
      maintenanceRecord = mrData;

      if (property.manager_phone) {
        const landlordMsg = buildLandlordSms({
          propertyName: property.name,
          unit: tenant.unit,
          tenantName: tenant.name,
          tenantPhone: tenantWithPhone.phone ?? null,
          issue: maintenanceRequest.issue,
          urgency: maintenanceRequest.urgency,
        });
        await sendSms(toE164(property.manager_phone), landlordMsg).catch(
          (err) => console.error("Failed to SMS landlord:", err)
        );
      }
    }

    // Save assistant message (display text only)
    await supabase.from("chat_messages").insert({
      tenant_id: user.id,
      role: "assistant",
      content: displayText,
    });

    return NextResponse.json({
      reply: displayText,
      maintenanceRequest: maintenanceRecord,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
