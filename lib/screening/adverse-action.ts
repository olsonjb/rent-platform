const FLAG_REASON_MAP: Record<string, string> = {
  low_income: "Income does not meet the minimum requirement of 3x monthly rent.",
  insufficient_income: "Income does not meet the minimum requirement of 3x monthly rent.",
  low_credit: "Credit score does not meet minimum qualification criteria.",
  poor_credit: "Credit score does not meet minimum qualification criteria.",
  credit_risk: "Credit score does not meet minimum qualification criteria.",
  previous_eviction: "Prior eviction history noted on application.",
  previous_evictions: "Prior eviction history noted on application.",
  eviction_history: "Prior eviction history noted on application.",
  short_rental_history: "Insufficient rental history (less than 1 year).",
  limited_rental_history: "Insufficient rental history (less than 1 year).",
  short_employment: "Employment duration does not meet minimum requirement.",
  insufficient_employment: "Employment duration does not meet minimum requirement.",
  no_references: "No verifiable references provided.",
  missing_references: "No verifiable references provided.",
  parse_error: "Unable to complete automated screening review.",
};

const DEFAULT_REASON = "Application did not meet qualification criteria.";

export function mapFlagsToReasons(flags: string[]): string[] {
  if (flags.length === 0) {
    return [DEFAULT_REASON];
  }

  const reasons: string[] = [];
  const seen = new Set<string>();

  for (const flag of flags) {
    const reason = FLAG_REASON_MAP[flag] ?? `${flag.replace(/_/g, " ")}: does not meet qualification criteria.`;
    if (!seen.has(reason)) {
      seen.add(reason);
      reasons.push(reason);
    }
  }

  return reasons;
}

export function generateAdverseActionNotice(
  applicantName: string,
  reasons: string[],
  propertyAddress: string,
): string {
  const reasonsList = reasons.map((r, i) => `  ${i + 1}. ${r}`).join("\n");

  return `NOTICE OF ADVERSE ACTION

Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

Dear ${applicantName},

We regret to inform you that your rental application for the property located at ${propertyAddress} has been denied.

REASON(S) FOR DENIAL:
${reasonsList}

YOUR RIGHTS UNDER THE FAIR CREDIT REPORTING ACT (FCRA):

You have the right to:
- Obtain a free copy of your consumer report from the reporting agency within 60 days of this notice.
- Dispute the accuracy or completeness of any information in your consumer report with the reporting agency.
- Request that the reporting agency provide notification of any correction, deletion, or addition to your file to any person who received your report in the past two years for employment purposes, or in the past year for other purposes.

The decision to deny your application was made by the property landlord. The consumer reporting agency did not make the decision and is unable to explain why the decision was made.

If you have questions about this notice, please contact the property management at the address listed above.

This notice is provided in accordance with the Fair Credit Reporting Act (15 U.S.C. § 1681 et seq.) and the Fair Housing Act (42 U.S.C. § 3601-3619).`;
}
