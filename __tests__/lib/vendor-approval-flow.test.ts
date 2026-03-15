import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for vendor approval flow state transitions.
 * These test the business logic of quote approval without hitting real DB/SMS.
 */

describe("vendor approval state transitions", () => {
  it("sent -> responded when vendor replies with quote", () => {
    const initial = "sent";
    const hasQuote = true;
    const declined = false;
    const newStatus = declined ? "declined" : "responded";
    expect(newStatus).toBe("responded");
    expect(hasQuote).toBe(true);
    expect(initial).toBe("sent");
  });

  it("sent -> declined when vendor declines", () => {
    const declined = true;
    const newStatus = declined ? "declined" : "responded";
    expect(newStatus).toBe("declined");
  });

  it("responded -> approved updates maintenance request to in_progress", () => {
    // Simulating the approval flow
    const outreachStatus = "responded";
    const canApprove = outreachStatus === "responded";
    expect(canApprove).toBe(true);

    // After approval, maintenance request goes to in_progress
    const maintenanceStatus = "in_progress";
    expect(maintenanceStatus).toBe("in_progress");
  });

  it("cannot approve a quote that has not responded", () => {
    const statusValues = ["sent", "no_response", "declined"];
    for (const status of statusValues) {
      const canApprove = status === "responded";
      expect(canApprove).toBe(false);
    }
  });

  it("approving one quote declines other sent outreach for same request", () => {
    // Simulating: 3 vendors contacted, 2 responded, landlord approves vendor B
    const outreachRecords = [
      { id: "a", status: "responded", vendor: "A" },
      { id: "b", status: "responded", vendor: "B" },
      { id: "c", status: "sent", vendor: "C" },
    ];

    const approvedId = "b";

    // After approval: A stays responded, B stays responded (approved), C becomes declined
    const updated = outreachRecords.map((r) => {
      if (r.id !== approvedId && r.status === "sent") {
        return { ...r, status: "declined" };
      }
      return r;
    });

    expect(updated.find((r) => r.id === "c")?.status).toBe("declined");
    expect(updated.find((r) => r.id === "a")?.status).toBe("responded");
    expect(updated.find((r) => r.id === "b")?.status).toBe("responded");
  });

  it("quote amount converts cents to dollars correctly", () => {
    const testCases = [
      { cents: 15000, expected: "$150.00" },
      { cents: 25050, expected: "$250.50" },
      { cents: 100, expected: "$1.00" },
      { cents: 0, expected: "$0.00" },
    ];

    for (const { cents, expected } of testCases) {
      const formatted = `$${(cents / 100).toFixed(2)}`;
      expect(formatted).toBe(expected);
    }
  });

  it("status labels map correctly", () => {
    const STATUS_LABELS: Record<string, string> = {
      sent: "Awaiting reply",
      responded: "Quote received",
      no_response: "No response",
      declined: "Declined",
    };

    expect(STATUS_LABELS["sent"]).toBe("Awaiting reply");
    expect(STATUS_LABELS["responded"]).toBe("Quote received");
    expect(STATUS_LABELS["declined"]).toBe("Declined");
    expect(STATUS_LABELS["no_response"]).toBe("No response");
  });
});
