import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createLogger } from "@/lib/logger";

const logger = createLogger("twilio-validate");

/**
 * Validate that an incoming request originated from Twilio by checking the
 * X-Twilio-Signature header against the request body and auth token.
 *
 * When TWILIO_SKIP_VALIDATION=true (dev only), validation is bypassed.
 *
 * Returns null if the request is valid, or a 403 TwiML NextResponse if invalid.
 */
export async function validateTwilioWebhook(
  request: NextRequest,
): Promise<NextResponse | null> {
  // Dev bypass
  if (process.env.TWILIO_SKIP_VALIDATION === "true") {
    logger.debug("Twilio signature validation skipped (TWILIO_SKIP_VALIDATION=true)");
    return null;
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    logger.error("TWILIO_AUTH_TOKEN is not configured");
    return twimlError();
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) {
    logger.warn("Missing X-Twilio-Signature header");
    return twimlError();
  }

  // Determine the webhook URL Twilio used to sign the request
  const webhookUrl =
    process.env.TWILIO_WEBHOOK_URL ?? buildUrlFromRequest(request);

  // Clone the request to read the body without consuming it.
  // Twilio sends form-encoded data; we need the params as a Record.
  const cloned = request.clone();
  const formData = await cloned.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const isValid = twilio.validateRequest(authToken, signature, webhookUrl, params);

  if (!isValid) {
    logger.warn({ url: webhookUrl }, "Invalid Twilio webhook signature");
    return twimlError();
  }

  return null;
}

/**
 * Validate that an internal API request carries a valid X-Internal-Secret
 * header matching the INTERNAL_API_SECRET environment variable.
 *
 * Returns null if authorized, or a 401 JSON NextResponse if not.
 */
export function validateInternalSecret(
  request: NextRequest,
): NextResponse | null {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    logger.error("INTERNAL_API_SECRET is not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provided = request.headers.get("x-internal-secret");
  if (!provided || provided !== expected) {
    logger.warn("Invalid or missing X-Internal-Secret header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/** Build the canonical URL from a Next.js request for signature validation. */
function buildUrlFromRequest(request: NextRequest): string {
  const url = new URL(request.url);
  // Use the forwarded protocol/host if behind a proxy (Vercel),
  // otherwise fall back to the request URL.
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}${url.pathname}`;
}

/** Return a 403 TwiML response with a generic error message. */
function twimlError(): NextResponse {
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  twiml.message("Request could not be validated.");
  return new NextResponse(twiml.toString(), {
    status: 403,
    headers: { "Content-Type": "text/xml" },
  });
}
