import { describe, it, expect } from "vitest";
import { mapFlagsToReasons, generateAdverseActionNotice } from "@/lib/screening/adverse-action";

describe("mapFlagsToReasons", () => {
  it("maps known flags to human-readable reasons", () => {
    const reasons = mapFlagsToReasons(["low_income", "poor_credit"]);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain("3x monthly rent");
    expect(reasons[1]).toContain("Credit score");
  });

  it("deduplicates identical reasons from synonym flags", () => {
    const reasons = mapFlagsToReasons(["low_income", "insufficient_income"]);
    expect(reasons).toHaveLength(1);
  });

  it("returns default reason for empty flags", () => {
    const reasons = mapFlagsToReasons([]);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("did not meet qualification criteria");
  });

  it("handles unknown flags with fallback formatting", () => {
    const reasons = mapFlagsToReasons(["custom_flag"]);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("custom flag");
  });

  it("maps eviction-related flags", () => {
    const reasons = mapFlagsToReasons(["previous_eviction"]);
    expect(reasons[0]).toContain("eviction");
  });

  it("maps employment-related flags", () => {
    const reasons = mapFlagsToReasons(["short_employment"]);
    expect(reasons[0]).toContain("Employment duration");
  });

  it("maps reference-related flags", () => {
    const reasons = mapFlagsToReasons(["no_references"]);
    expect(reasons[0]).toContain("references");
  });

  it("handles multiple flags of different types", () => {
    const reasons = mapFlagsToReasons([
      "low_income",
      "previous_evictions",
      "no_references",
      "short_employment",
    ]);
    expect(reasons).toHaveLength(4);
  });
});

describe("generateAdverseActionNotice", () => {
  it("generates a notice with applicant name and property address", () => {
    const notice = generateAdverseActionNotice(
      "John Doe",
      ["Income does not meet the minimum requirement of 3x monthly rent."],
      "123 Main St",
    );
    expect(notice).toContain("John Doe");
    expect(notice).toContain("123 Main St");
    expect(notice).toContain("NOTICE OF ADVERSE ACTION");
  });

  it("includes FCRA rights", () => {
    const notice = generateAdverseActionNotice("Jane Smith", ["Test reason"], "456 Oak Ave");
    expect(notice).toContain("Fair Credit Reporting Act");
    expect(notice).toContain("right to");
    expect(notice).toContain("Dispute");
  });

  it("includes Fair Housing Act reference", () => {
    const notice = generateAdverseActionNotice("Jane Smith", ["Test reason"], "456 Oak Ave");
    expect(notice).toContain("Fair Housing Act");
  });

  it("lists all denial reasons numbered", () => {
    const reasons = [
      "Income does not meet the minimum requirement.",
      "Credit score does not meet criteria.",
    ];
    const notice = generateAdverseActionNotice("Test User", reasons, "789 Elm");
    expect(notice).toContain("1. Income does not meet");
    expect(notice).toContain("2. Credit score does not meet");
  });

  it("includes current date", () => {
    const notice = generateAdverseActionNotice("Test User", ["Reason"], "Addr");
    // The notice should contain a date-like string
    const year = new Date().getFullYear().toString();
    expect(notice).toContain(year);
  });
});
