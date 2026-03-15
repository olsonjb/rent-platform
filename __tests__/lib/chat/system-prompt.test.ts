import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";

const baseContext = () => ({
  propertyName: "Maple Apartments",
  propertyAddress: "456 Maple Ave, SLC, UT",
  tenantName: "Jane Doe",
  unit: "101",
  rentDueDay: 1,
  parkingPolicy: "One assigned spot per unit",
  petPolicy: "Cats allowed, no dogs",
  quietHours: "10 PM - 7 AM",
  leaseTerms: "12-month lease, no subletting",
  managerName: "Bob Manager",
  managerPhone: "+15551234567",
});

describe("buildSystemPrompt", () => {
  it("includes property fields in prompt", () => {
    const prompt = buildSystemPrompt(baseContext());
    expect(prompt).toContain("Maple Apartments");
    expect(prompt).toContain("456 Maple Ave");
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("Unit: 101");
    expect(prompt).toContain("One assigned spot per unit");
    expect(prompt).toContain("Cats allowed, no dogs");
    expect(prompt).toContain("10 PM - 7 AM");
    expect(prompt).toContain("12-month lease, no subletting");
    expect(prompt).toContain("Bob Manager");
    expect(prompt).toContain("+15551234567");
  });

  it("handles null policies with fallback text", () => {
    const ctx = baseContext();
    ctx.parkingPolicy = null;
    ctx.petPolicy = null;
    ctx.quietHours = null;
    ctx.leaseTerms = null;
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("No policy on file");
    expect(prompt).toContain("No terms on file");
  });

  it("handles null manager with fallback text", () => {
    const ctx = baseContext();
    ctx.managerName = null;
    ctx.managerPhone = null;
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("Not listed");
    expect(prompt).toContain("No phone on file");
  });

  it("uses correct ordinal suffix for rent due day", () => {
    const ctx1 = baseContext();
    ctx1.rentDueDay = 1;
    expect(buildSystemPrompt(ctx1)).toContain("1st of each month");

    const ctx2 = baseContext();
    ctx2.rentDueDay = 2;
    expect(buildSystemPrompt(ctx2)).toContain("2nd of each month");

    const ctx3 = baseContext();
    ctx3.rentDueDay = 3;
    expect(buildSystemPrompt(ctx3)).toContain("3rd of each month");

    const ctx4 = baseContext();
    ctx4.rentDueDay = 15;
    expect(buildSystemPrompt(ctx4)).toContain("15th of each month");
  });

  it("includes maintenance JSON format instructions", () => {
    const prompt = buildSystemPrompt(baseContext());
    expect(prompt).toContain("|||MAINTENANCE_REQUEST|||");
    expect(prompt).toContain("|||END|||");
    expect(prompt).toContain('"issue"');
    expect(prompt).toContain('"urgency"');
  });

  it("includes urgency rules", () => {
    const prompt = buildSystemPrompt(baseContext());
    expect(prompt).toContain("habitability");
    expect(prompt).toContain("standard");
    expect(prompt).toContain("3-day repair window");
    expect(prompt).toContain("10-day repair window");
  });
});
