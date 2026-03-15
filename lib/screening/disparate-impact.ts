import { createServiceClient } from "@/lib/supabase/service";

const CREDIT_SCORE_RANGES = [
  "below_580",
  "580_619",
  "620_659",
  "660_699",
  "700_749",
  "750_plus",
] as const;

const INCOME_BRACKETS = [
  { label: "under_2000", min: 0, max: 2000 },
  { label: "2000_4000", min: 2000, max: 4000 },
  { label: "4000_6000", min: 4000, max: 6000 },
  { label: "6000_8000", min: 6000, max: 8000 },
  { label: "8000_plus", min: 8000, max: Infinity },
] as const;

const DEVIATION_THRESHOLD = 0.2;

export interface MetricRow {
  metric_type: "credit_score_range" | "income_bracket";
  category: string;
  total_applications: number;
  approved_count: number;
  denied_count: number;
  approval_rate: number;
  deviation_from_overall: number;
  flagged: boolean;
}

interface ApplicationRow {
  credit_score_range: string;
  monthly_income: number;
  status: string;
}

function getIncomeBracket(income: number): string {
  for (const bracket of INCOME_BRACKETS) {
    if (income >= bracket.min && income < bracket.max) {
      return bracket.label;
    }
  }
  return "8000_plus";
}

function computeMetrics(
  applications: ApplicationRow[],
  groupBy: "credit_score_range" | "income_bracket",
): MetricRow[] {
  const finalStatuses = ["landlord_approved", "landlord_denied"];
  const resolved = applications.filter((a) => finalStatuses.includes(a.status));

  if (resolved.length === 0) return [];

  const overallApproved = resolved.filter((a) => a.status === "landlord_approved").length;
  const overallRate = overallApproved / resolved.length;

  const groups = new Map<string, { approved: number; total: number }>();

  // Initialize groups
  if (groupBy === "credit_score_range") {
    for (const range of CREDIT_SCORE_RANGES) {
      groups.set(range, { approved: 0, total: 0 });
    }
  } else {
    for (const bracket of INCOME_BRACKETS) {
      groups.set(bracket.label, { approved: 0, total: 0 });
    }
  }

  for (const app of resolved) {
    const key =
      groupBy === "credit_score_range"
        ? app.credit_score_range
        : getIncomeBracket(app.monthly_income);

    const group = groups.get(key);
    if (group) {
      group.total += 1;
      if (app.status === "landlord_approved") {
        group.approved += 1;
      }
    }
  }

  const metrics: MetricRow[] = [];

  for (const [category, { approved, total }] of groups) {
    if (total === 0) continue;

    const approvalRate = approved / total;
    const deviation = approvalRate - overallRate;
    const flagged = Math.abs(deviation) > DEVIATION_THRESHOLD;

    metrics.push({
      metric_type: groupBy,
      category,
      total_applications: total,
      approved_count: approved,
      denied_count: total - approved,
      approval_rate: approvalRate,
      deviation_from_overall: deviation,
      flagged,
    });
  }

  return metrics;
}

export async function computeApprovalRatesByMetric(
  landlordId: string,
): Promise<{ creditScore: MetricRow[]; incomeBracket: MetricRow[] }> {
  const supabase = createServiceClient();

  // Fetch all resolved applications for this landlord's properties
  const { data, error } = await supabase
    .from("rental_applications")
    .select("credit_score_range, monthly_income, status, properties!inner(landlord_id)")
    .eq("properties.landlord_id", landlordId)
    .in("status", ["landlord_approved", "landlord_denied"]);

  if (error) {
    throw new Error(`Failed to fetch applications for disparate impact analysis: ${error.message}`);
  }

  const applications = (data ?? []) as unknown as ApplicationRow[];

  const creditScore = computeMetrics(applications, "credit_score_range");
  const incomeBracket = computeMetrics(applications, "income_bracket");

  // Store metrics
  const allMetrics = [...creditScore, ...incomeBracket].map((m) => ({
    ...m,
    landlord_id: landlordId,
    computed_at: new Date().toISOString(),
  }));

  if (allMetrics.length > 0) {
    // Clear old metrics for this landlord
    await supabase
      .from("screening_metrics")
      .delete()
      .eq("landlord_id", landlordId);

    await supabase.from("screening_metrics").insert(allMetrics);
  }

  return { creditScore, incomeBracket };
}

// Re-export for testing
export { computeMetrics as _computeMetrics, getIncomeBracket as _getIncomeBracket };
