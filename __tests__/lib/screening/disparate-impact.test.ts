import { describe, it, expect, vi } from "vitest";

// We test the pure computation functions directly
import {
  _computeMetrics as computeMetrics,
  _getIncomeBracket as getIncomeBracket,
} from "@/lib/screening/disparate-impact";

// Mock supabase to avoid import errors (module has side effects)
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({})),
}));

describe("getIncomeBracket", () => {
  it("returns under_2000 for incomes below 2000", () => {
    expect(getIncomeBracket(1500)).toBe("under_2000");
  });

  it("returns 2000_4000 for incomes in range", () => {
    expect(getIncomeBracket(3000)).toBe("2000_4000");
  });

  it("returns 4000_6000 for incomes in range", () => {
    expect(getIncomeBracket(5000)).toBe("4000_6000");
  });

  it("returns 6000_8000 for incomes in range", () => {
    expect(getIncomeBracket(7000)).toBe("6000_8000");
  });

  it("returns 8000_plus for high incomes", () => {
    expect(getIncomeBracket(10000)).toBe("8000_plus");
  });

  it("returns 8000_plus for exactly 8000", () => {
    expect(getIncomeBracket(8000)).toBe("8000_plus");
  });

  it("returns under_2000 for zero income", () => {
    expect(getIncomeBracket(0)).toBe("under_2000");
  });
});

describe("computeMetrics", () => {
  it("returns empty array when no resolved applications", () => {
    const apps = [
      { credit_score_range: "700_749", monthly_income: 5000, status: "pending" },
      { credit_score_range: "700_749", monthly_income: 5000, status: "screening" },
    ];
    const result = computeMetrics(apps, "credit_score_range");
    expect(result).toEqual([]);
  });

  it("computes metrics by credit score range", () => {
    const apps = [
      { credit_score_range: "700_749", monthly_income: 6000, status: "landlord_approved" },
      { credit_score_range: "700_749", monthly_income: 5000, status: "landlord_approved" },
      { credit_score_range: "below_580", monthly_income: 2000, status: "landlord_denied" },
      { credit_score_range: "below_580", monthly_income: 1800, status: "landlord_denied" },
    ];

    const result = computeMetrics(apps, "credit_score_range");
    const highCredit = result.find((r) => r.category === "700_749");
    const lowCredit = result.find((r) => r.category === "below_580");

    expect(highCredit).toBeDefined();
    expect(highCredit!.approval_rate).toBe(1.0); // 2/2
    expect(lowCredit).toBeDefined();
    expect(lowCredit!.approval_rate).toBe(0.0); // 0/2
  });

  it("computes metrics by income bracket", () => {
    const apps = [
      { credit_score_range: "700_749", monthly_income: 7000, status: "landlord_approved" },
      { credit_score_range: "620_659", monthly_income: 3000, status: "landlord_denied" },
    ];

    const result = computeMetrics(apps, "income_bracket");
    const highIncome = result.find((r) => r.category === "6000_8000");
    const lowIncome = result.find((r) => r.category === "2000_4000");

    expect(highIncome!.approval_rate).toBe(1.0);
    expect(lowIncome!.approval_rate).toBe(0.0);
  });

  it("flags categories with >20% deviation from overall rate", () => {
    // Overall: 3 approved out of 5 = 60%
    // 700_749: 3/3 = 100% → deviation = +40% → flagged
    // below_580: 0/2 = 0% → deviation = -60% → flagged
    const apps = [
      { credit_score_range: "700_749", monthly_income: 6000, status: "landlord_approved" },
      { credit_score_range: "700_749", monthly_income: 6000, status: "landlord_approved" },
      { credit_score_range: "700_749", monthly_income: 6000, status: "landlord_approved" },
      { credit_score_range: "below_580", monthly_income: 2000, status: "landlord_denied" },
      { credit_score_range: "below_580", monthly_income: 2000, status: "landlord_denied" },
    ];

    const result = computeMetrics(apps, "credit_score_range");
    const high = result.find((r) => r.category === "700_749");
    const low = result.find((r) => r.category === "below_580");

    expect(high!.flagged).toBe(true);
    expect(low!.flagged).toBe(true);
  });

  it("does not flag categories within 20% deviation", () => {
    // All same credit range, 2 approved, 1 denied: 66.7% overall
    // Only one category → deviation = 0
    const apps = [
      { credit_score_range: "700_749", monthly_income: 6000, status: "landlord_approved" },
      { credit_score_range: "700_749", monthly_income: 5000, status: "landlord_approved" },
      { credit_score_range: "700_749", monthly_income: 4000, status: "landlord_denied" },
    ];

    const result = computeMetrics(apps, "credit_score_range");
    expect(result).toHaveLength(1);
    expect(result[0].flagged).toBe(false);
  });

  it("skips categories with zero total", () => {
    const apps = [
      { credit_score_range: "700_749", monthly_income: 6000, status: "landlord_approved" },
    ];

    const result = computeMetrics(apps, "credit_score_range");
    // Only 700_749 should appear; other credit ranges have 0 total
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("700_749");
  });

  it("correctly computes denied_count", () => {
    const apps = [
      { credit_score_range: "700_749", monthly_income: 6000, status: "landlord_approved" },
      { credit_score_range: "700_749", monthly_income: 6000, status: "landlord_denied" },
      { credit_score_range: "700_749", monthly_income: 6000, status: "landlord_denied" },
    ];

    const result = computeMetrics(apps, "credit_score_range");
    expect(result[0].denied_count).toBe(2);
    expect(result[0].approved_count).toBe(1);
    expect(result[0].total_applications).toBe(3);
  });
});
