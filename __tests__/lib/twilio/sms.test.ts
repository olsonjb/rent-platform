import { describe, it, expect, beforeEach, vi } from "vitest";
import { installTwilioMock, mockMessagesCreate } from "../../mocks/twilio";

installTwilioMock();

import { toE164, normalizeFromForLookup, buildLandlordSms, sendSms } from "@/lib/twilio/sms";

describe("toE164", () => {
  it("converts 10-digit US number to E.164", () => {
    expect(toE164("8015551234")).toBe("+18015551234");
  });

  it("converts 11-digit US number with leading 1 to E.164", () => {
    expect(toE164("18015551234")).toBe("+18015551234");
  });

  it("strips non-digit characters", () => {
    expect(toE164("(801) 555-1234")).toBe("+18015551234");
  });

  it("handles already-formatted E.164", () => {
    expect(toE164("+18015551234")).toBe("+18015551234");
  });

  it("handles international number (non-US)", () => {
    // 12-digit number — just prepends +
    expect(toE164("441234567890")).toBe("+441234567890");
  });
});

describe("normalizeFromForLookup", () => {
  it("returns whatsapp prefix as-is", () => {
    expect(normalizeFromForLookup("whatsapp:+18015551234")).toBe("whatsapp:+18015551234");
  });

  it("normalizes SMS number to E.164", () => {
    expect(normalizeFromForLookup("+18015551234")).toBe("+18015551234");
  });

  it("normalizes bare digits", () => {
    expect(normalizeFromForLookup("8015551234")).toBe("+18015551234");
  });
});

describe("buildLandlordSms", () => {
  it("builds standard message with tenant phone", () => {
    const msg = buildLandlordSms({
      propertyName: "Maple Apartments",
      unit: "101",
      tenantName: "Jane Doe",
      tenantPhone: "+15559876543",
      issue: "Leaking faucet",
      urgency: "standard",
    });
    expect(msg).toContain("Maple Apartments");
    expect(msg).toContain("Unit 101");
    expect(msg).toContain("Jane Doe");
    expect(msg).toContain("Leaking faucet");
    expect(msg).toContain("Standard (10-day repair window)");
    expect(msg).toContain("+15559876543");
  });

  it("builds habitability urgent message", () => {
    const msg = buildLandlordSms({
      propertyName: "Oak Towers",
      unit: "202",
      tenantName: "John Smith",
      tenantPhone: null,
      issue: "No hot water",
      urgency: "habitability",
    });
    expect(msg).toContain("URGENT - habitability issue (3-day repair window)");
    expect(msg).not.toContain("Tenant contact:");
  });

  it("omits tenant phone line when null", () => {
    const msg = buildLandlordSms({
      propertyName: "Test",
      unit: "1",
      tenantName: "T",
      tenantPhone: null,
      issue: "Test issue",
      urgency: "standard",
    });
    expect(msg).not.toContain("Tenant contact:");
  });
});

describe("sendSms", () => {
  beforeEach(() => {
    mockMessagesCreate.mockClear();
  });

  it("sends regular SMS", async () => {
    await sendSms("+18015551234", "Hello");
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      from: "+15551234567",
      to: "+18015551234",
      body: "Hello",
    });
  });

  it("sends WhatsApp message with whatsapp prefix on from", async () => {
    await sendSms("whatsapp:+18015551234", "Hello WhatsApp");
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      from: "whatsapp:+15551234567",
      to: "whatsapp:+18015551234",
      body: "Hello WhatsApp",
    });
  });
});
