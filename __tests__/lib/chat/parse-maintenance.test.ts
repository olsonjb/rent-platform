import { describe, it, expect } from "vitest";
import { parseMaintenanceRequests } from "@/lib/chat/parse-maintenance";

describe("parseMaintenanceRequests", () => {
  it("returns original text with no requests when no delimiters present", () => {
    const text = "Your sink looks fine. No issues detected.";
    const result = parseMaintenanceRequests(text);
    expect(result.displayText).toBe("Your sink looks fine. No issues detected.");
    expect(result.maintenanceRequests).toEqual([]);
  });

  it("returns empty array for plain whitespace-only text", () => {
    const result = parseMaintenanceRequests("  \n  ");
    expect(result.displayText).toBe("");
    expect(result.maintenanceRequests).toEqual([]);
  });

  it("parses a single maintenance request", () => {
    const text =
      'I have filed a maintenance request for you.|||MAINTENANCE_REQUEST|||{"issue":"Leaking faucet in kitchen","urgency":"standard"}|||END|||';
    const result = parseMaintenanceRequests(text);
    expect(result.displayText).toBe("I have filed a maintenance request for you.");
    expect(result.maintenanceRequests).toHaveLength(1);
    expect(result.maintenanceRequests[0]).toEqual({
      issue: "Leaking faucet in kitchen",
      urgency: "standard",
    });
  });

  it("parses multiple maintenance requests", () => {
    const text = [
      "I have filed two requests.",
      '|||MAINTENANCE_REQUEST|||{"issue":"No hot water","urgency":"habitability"}|||END|||',
      '|||MAINTENANCE_REQUEST|||{"issue":"Broken window latch","urgency":"standard"}|||END|||',
    ].join("");
    const result = parseMaintenanceRequests(text);
    expect(result.displayText).toBe("I have filed two requests.");
    expect(result.maintenanceRequests).toHaveLength(2);
    expect(result.maintenanceRequests[0].issue).toBe("No hot water");
    expect(result.maintenanceRequests[0].urgency).toBe("habitability");
    expect(result.maintenanceRequests[1].issue).toBe("Broken window latch");
    expect(result.maintenanceRequests[1].urgency).toBe("standard");
  });

  it("skips malformed JSON blocks", () => {
    const text =
      "Filed.|||MAINTENANCE_REQUEST|||{bad json}|||END|||" +
      '|||MAINTENANCE_REQUEST|||{"issue":"Valid one","urgency":"standard"}|||END|||';
    const result = parseMaintenanceRequests(text);
    expect(result.displayText).toBe("Filed.");
    expect(result.maintenanceRequests).toHaveLength(1);
    expect(result.maintenanceRequests[0].issue).toBe("Valid one");
  });

  it("skips blocks missing required fields (issue)", () => {
    const text =
      'Filed.|||MAINTENANCE_REQUEST|||{"urgency":"standard"}|||END|||';
    const result = parseMaintenanceRequests(text);
    expect(result.maintenanceRequests).toHaveLength(0);
  });

  it("skips blocks missing required fields (urgency)", () => {
    const text =
      'Filed.|||MAINTENANCE_REQUEST|||{"issue":"something"}|||END|||';
    const result = parseMaintenanceRequests(text);
    expect(result.maintenanceRequests).toHaveLength(0);
  });

  it("handles missing END delimiter gracefully", () => {
    const text =
      'Filed.|||MAINTENANCE_REQUEST|||{"issue":"test","urgency":"standard"}';
    const result = parseMaintenanceRequests(text);
    expect(result.displayText).toBe("Filed.");
    expect(result.maintenanceRequests).toHaveLength(0);
  });

  it("handles delimiter at the very start of text", () => {
    const text =
      '|||MAINTENANCE_REQUEST|||{"issue":"test","urgency":"habitability"}|||END|||';
    const result = parseMaintenanceRequests(text);
    expect(result.displayText).toBe("");
    expect(result.maintenanceRequests).toHaveLength(1);
  });

  it("trims whitespace from display text", () => {
    const text =
      '  Hello there  |||MAINTENANCE_REQUEST|||{"issue":"test","urgency":"standard"}|||END|||';
    const result = parseMaintenanceRequests(text);
    expect(result.displayText).toBe("Hello there");
  });

  it("handles whitespace around JSON inside delimiters", () => {
    const text =
      'Filed.|||MAINTENANCE_REQUEST|||  {"issue":"Pest problem","urgency":"standard"}  |||END|||';
    const result = parseMaintenanceRequests(text);
    expect(result.maintenanceRequests).toHaveLength(1);
    expect(result.maintenanceRequests[0].issue).toBe("Pest problem");
  });
});
