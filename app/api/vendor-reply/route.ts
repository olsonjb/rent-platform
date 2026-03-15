import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";
import { createServiceClient } from "@/lib/supabase/service";
import { validateTwilioWebhook } from "@/lib/twilio/validate";
import { normalizeFromForLookup } from "@/lib/twilio/sms";
import { withAITracking } from "@/lib/ai-metrics";
import { createLogger, withCorrelationId } from "@/lib/logger";
import { getCorrelationId } from "@/lib/correlation";
import {
  rateLimit,
  RATE_LIMIT_CONFIGS,
  shouldBypass,
  rateLimitHeaders,
} from "@/lib/rate-limit";

const baseLogger = createLogger("vendor-reply");
const anthropic = new Anthropic();

interface ParsedVendorReply {
  quote_amount_cents: number | null;
  availability: string | null;
  notes: string | null;
  declined: boolean;
}

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

const PARSE_PROMPT = `You are parsing a vendor's SMS reply to a maintenance quote request.
Extract the following from the message:
- quote_amount_cents: the quoted dollar amount converted to cents (e.g. $150 = 15000). null if no amount given.
- availability: when they can do the work (e.g. "Monday", "next week", "tomorrow"). null if not mentioned.
- notes: any additional notes or conditions. null if none.
- declined: true if the vendor is declining the job, false otherwise.

Respond with ONLY a JSON object, no other text:
{"quote_amount_cents": number|null, "availability": string|null, "notes": string|null, "declined": boolean}`;

async function parseVendorReply(message: string): Promise<ParsedVendorReply> {
  const response = await withAITracking(
    { service: "vendor-reply", endpoint: "/api/vendor-reply" },
    () =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20241022",
        max_tokens: 200,
        temperature: 0,
        messages: [
          { role: "user", content: `${PARSE_PROMPT}\n\nVendor message:\n${message}` },
        ],
      }),
  );

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return { quote_amount_cents: null, availability: null, notes: message, declined: false };
  }

  try {
    const parsed = JSON.parse(match[0]) as ParsedVendorReply;
    return {
      quote_amount_cents: typeof parsed.quote_amount_cents === "number" ? parsed.quote_amount_cents : null,
      availability: typeof parsed.availability === "string" ? parsed.availability : null,
      notes: typeof parsed.notes === "string" ? parsed.notes : null,
      declined: parsed.declined === true,
    };
  } catch {
    return { quote_amount_cents: null, availability: null, notes: message, declined: false };
  }
}

export async function POST(request: NextRequest) {
  // Validate Twilio signature
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
    return twimlReply("Sorry, we couldn't process your message.", correlationId);
  }

  // Rate limiting
  if (!shouldBypass(request.headers)) {
    const rlResult = await rateLimit(`vendor-reply:${from}`, RATE_LIMIT_CONFIGS.sms);
    if (!rlResult.allowed) {
      const rlHeaders = rateLimitHeaders(rlResult, RATE_LIMIT_CONFIGS.sms);
      const MessagingResponse = twilio.twiml.MessagingResponse;
      const twiml = new MessagingResponse();
      twiml.message("Too many messages. Please wait and try again.");
      const headers: Record<string, string> = { "Content-Type": "text/xml", ...rlHeaders };
      if (correlationId) {
        headers["x-correlation-id"] = correlationId;
      }
      return new NextResponse(twiml.toString(), { status: 429, headers });
    }
  }

  const supabase = createServiceClient();
  const normalizedPhone = normalizeFromForLookup(from);

  // Find matching vendor outreach by phone number
  const { data: outreachRecords, error: lookupError } = await supabase
    .from("vendor_outreach")
    .select("id, maintenance_request_id, vendor_name, status")
    .eq("vendor_phone", normalizedPhone)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1);

  if (lookupError || !outreachRecords || outreachRecords.length === 0) {
    logger.info({ from: normalizedPhone }, "No pending outreach found for vendor phone");
    // Return empty TwiML — don't reply to unknown numbers
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    const headers: Record<string, string> = { "Content-Type": "text/xml" };
    if (correlationId) {
      headers["x-correlation-id"] = correlationId;
    }
    return new NextResponse(twiml.toString(), { headers });
  }

  const outreach = outreachRecords[0];

  // Parse the vendor reply using AI
  const parsed = await parseVendorReply(body);

  logger.info(
    { outreachId: outreach.id, parsed, vendor: outreach.vendor_name },
    "Parsed vendor reply",
  );

  // Update the outreach record
  const newStatus = parsed.declined ? "declined" as const : "responded" as const;
  const { error: updateError } = await supabase
    .from("vendor_outreach")
    .update({
      status: newStatus,
      quote_amount_cents: parsed.quote_amount_cents,
      quote_details: parsed.notes,
      vendor_availability: parsed.availability,
      responded_at: new Date().toISOString(),
    })
    .eq("id", outreach.id);

  if (updateError) {
    logger.error({ err: updateError, outreachId: outreach.id }, "Failed to update outreach record");
  }

  // Send confirmation back to vendor
  const replyMsg = parsed.declined
    ? "Thank you for letting us know. We appreciate your response."
    : "Thank you for your quote! The property manager will review and get back to you.";

  return twimlReply(replyMsg, correlationId);
}
