import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Hoist mock functions so they are available when vi.mock factories run
const { mockValidateRequest } = vi.hoisted(() => {
  return {
    mockValidateRequest: vi.fn(),
  };
});

vi.mock("twilio", () => {
  function MessagingResponse() {
    // @ts-expect-error - mock constructor
    this._messages = [];
  }
  MessagingResponse.prototype.message = function (msg: string) {
    this._messages.push(msg);
  };
  MessagingResponse.prototype.toString = function () {
    return `<Response><Message>${this._messages.join("")}</Message></Response>`;
  };

  const twiml = { MessagingResponse };
  return {
    default: {
      validateRequest: mockValidateRequest,
      twiml,
    },
  };
});

vi.mock("pino", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  return {
    default: vi.fn(() => mockLogger),
  };
});

import { validateTwilioWebhook, validateInternalSecret } from "@/lib/twilio/validate";

function buildRequest(options: {
  url?: string;
  headers?: Record<string, string>;
  body?: Record<string, string>;
}): NextRequest {
  const url = options.url ?? "https://example.com/api/sms";
  const formBody = new URLSearchParams(options.body ?? { From: "+15551234567", Body: "Hello" });

  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(options.headers ?? {}),
    },
    body: formBody.toString(),
  });
}

describe("validateTwilioWebhook", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
    delete process.env.TWILIO_SKIP_VALIDATION;
    delete process.env.TWILIO_WEBHOOK_URL;
    mockValidateRequest.mockReset();
  });

  afterEach(() => {
    if (originalEnv.TWILIO_AUTH_TOKEN) {
      process.env.TWILIO_AUTH_TOKEN = originalEnv.TWILIO_AUTH_TOKEN;
    } else {
      delete process.env.TWILIO_AUTH_TOKEN;
    }
    if (originalEnv.TWILIO_SKIP_VALIDATION) {
      process.env.TWILIO_SKIP_VALIDATION = originalEnv.TWILIO_SKIP_VALIDATION;
    } else {
      delete process.env.TWILIO_SKIP_VALIDATION;
    }
    if (originalEnv.TWILIO_WEBHOOK_URL) {
      process.env.TWILIO_WEBHOOK_URL = originalEnv.TWILIO_WEBHOOK_URL;
    } else {
      delete process.env.TWILIO_WEBHOOK_URL;
    }
  });

  it("returns null (passes) when signature is valid", async () => {
    mockValidateRequest.mockReturnValue(true);
    const req = buildRequest({
      headers: { "x-twilio-signature": "valid-sig" },
    });

    const result = await validateTwilioWebhook(req);

    expect(result).toBeNull();
    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test-auth-token",
      "valid-sig",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("returns 403 TwiML when signature is invalid", async () => {
    mockValidateRequest.mockReturnValue(false);
    const req = buildRequest({
      headers: { "x-twilio-signature": "bad-sig" },
    });

    const result = await validateTwilioWebhook(req);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    expect(result!.headers.get("content-type")).toBe("text/xml");
  });

  it("returns 403 TwiML when X-Twilio-Signature header is missing", async () => {
    const req = buildRequest({
      headers: {},
    });

    const result = await validateTwilioWebhook(req);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    expect(result!.headers.get("content-type")).toBe("text/xml");
    expect(mockValidateRequest).not.toHaveBeenCalled();
  });

  it("returns 403 TwiML when TWILIO_AUTH_TOKEN is not configured", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const req = buildRequest({
      headers: { "x-twilio-signature": "some-sig" },
    });

    const result = await validateTwilioWebhook(req);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("bypasses validation when TWILIO_SKIP_VALIDATION=true", async () => {
    process.env.TWILIO_SKIP_VALIDATION = "true";
    const req = buildRequest({
      headers: {},
    });

    const result = await validateTwilioWebhook(req);

    expect(result).toBeNull();
    expect(mockValidateRequest).not.toHaveBeenCalled();
  });

  it("does not bypass when TWILIO_SKIP_VALIDATION is not 'true'", async () => {
    process.env.TWILIO_SKIP_VALIDATION = "false";
    const req = buildRequest({
      headers: {},
    });

    const result = await validateTwilioWebhook(req);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("uses TWILIO_WEBHOOK_URL when set", async () => {
    process.env.TWILIO_WEBHOOK_URL = "https://my-app.vercel.app/api/sms";
    mockValidateRequest.mockReturnValue(true);
    const req = buildRequest({
      headers: { "x-twilio-signature": "valid-sig" },
    });

    await validateTwilioWebhook(req);

    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test-auth-token",
      "valid-sig",
      "https://my-app.vercel.app/api/sms",
      expect.any(Object),
    );
  });

  it("constructs URL from request when TWILIO_WEBHOOK_URL is not set", async () => {
    mockValidateRequest.mockReturnValue(true);
    const req = buildRequest({
      url: "https://example.com/api/sms",
      headers: {
        "x-twilio-signature": "valid-sig",
        "host": "example.com",
        "x-forwarded-proto": "https",
      },
    });

    await validateTwilioWebhook(req);

    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test-auth-token",
      "valid-sig",
      "https://example.com/api/sms",
      expect.any(Object),
    );
  });

  it("passes form data params to validateRequest", async () => {
    mockValidateRequest.mockReturnValue(true);
    const req = buildRequest({
      headers: { "x-twilio-signature": "valid-sig" },
      body: { From: "+15559876543", Body: "Test message" },
    });

    await validateTwilioWebhook(req);

    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test-auth-token",
      "valid-sig",
      expect.any(String),
      expect.objectContaining({
        From: "+15559876543",
        Body: "Test message",
      }),
    );
  });
});

describe("validateInternalSecret", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "super-secret-123";
  });

  afterEach(() => {
    process.env.INTERNAL_API_SECRET = originalEnv.INTERNAL_API_SECRET;
  });

  it("returns null (passes) when X-Internal-Secret matches", () => {
    const req = new NextRequest("https://example.com/api/internal/test", {
      method: "POST",
      headers: { "x-internal-secret": "super-secret-123" },
    });

    const result = validateInternalSecret(req);
    expect(result).toBeNull();
  });

  it("returns 401 when X-Internal-Secret header is missing", () => {
    const req = new NextRequest("https://example.com/api/internal/test", {
      method: "POST",
    });

    const result = validateInternalSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when X-Internal-Secret header is wrong", () => {
    const req = new NextRequest("https://example.com/api/internal/test", {
      method: "POST",
      headers: { "x-internal-secret": "wrong-secret" },
    });

    const result = validateInternalSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when INTERNAL_API_SECRET env var is not set", () => {
    delete process.env.INTERNAL_API_SECRET;
    const req = new NextRequest("https://example.com/api/internal/test", {
      method: "POST",
      headers: { "x-internal-secret": "any-value" },
    });

    const result = validateInternalSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 JSON response with error field", async () => {
    const req = new NextRequest("https://example.com/api/internal/test", {
      method: "POST",
    });

    const result = validateInternalSecret(req);
    expect(result).not.toBeNull();
    const body = await result!.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
