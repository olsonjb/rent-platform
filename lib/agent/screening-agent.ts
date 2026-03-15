import Anthropic from '@anthropic-ai/sdk';
import { withAITracking } from '@/lib/ai-metrics';
import type { ScreeningDecision } from '@/lib/types';

interface ScreeningInput {
  application: {
    full_name: string;
    credit_score_range: string;
    monthly_income: number;
    employer_name: string | null;
    employment_duration_months: number | null;
    employment_type: string | null;
    years_renting: number;
    previous_evictions: boolean;
    references: { name: string; phone: string; relationship: string }[];
    social_media_links?: string[]; // kept for interface compat, never sent to AI
  };
  property: {
    address: string;
    monthly_rent: number;
  };
}

const CREDIT_LABELS: Record<string, string> = {
  below_580: 'Below 580 (Poor)',
  '580_619': '580-619 (Fair)',
  '620_659': '620-659 (Good)',
  '660_699': '660-699 (Very Good)',
  '700_749': '700-749 (Excellent)',
  '750_plus': '750+ (Exceptional)',
};

const FALLBACK_DECISION: ScreeningDecision = {
  approved: false,
  reasoning: 'Failed to parse AI screening response',
  risk_score: 100,
  income_ratio: 0,
  flags: ['parse_error'],
  confidence: 0,
  social_media_notes: null,
};

const client = new Anthropic();

export async function screenApplication(input: ScreeningInput): Promise<ScreeningDecision> {
  const incomeRatio = input.property.monthly_rent > 0
    ? input.application.monthly_income / input.property.monthly_rent
    : 0;

  const prompt = `You are a tenant screening AI for residential rentals. Evaluate this rental application and provide an advisory recommendation. Your recommendation is NOT a final decision — a human landlord must review and approve or deny every application.

FAIR HOUSING COMPLIANCE:
- Decisions must be based ONLY on: financial qualification, rental history, and verifiable references.
- Do NOT infer or consider race, religion, national origin, sex, familial status, or disability from any input data.
- Do NOT consider: name-based ethnicity inference, neighborhood demographics, familial status, or any protected characteristic.
- Do NOT analyze or reference social media content.

SCREENING CRITERIA:
- Income >= 3x rent required (below 2.5x = auto-deny)
- Credit: below_580 = high risk, 580_619 = moderate risk, 620+ = acceptable
- Previous evictions = serious red flag
- Less than 1 year renting = minor flag
- Employment < 6 months = minor flag; self-employed needs 3.5x income
- 0 references = minor flag

APPLICATION:
- Credit Score Range: ${CREDIT_LABELS[input.application.credit_score_range] ?? input.application.credit_score_range}
- Monthly Income: $${input.application.monthly_income.toFixed(2)}
- Employer: ${input.application.employer_name ?? 'Not provided'}
- Employment Duration: ${input.application.employment_duration_months != null ? `${input.application.employment_duration_months} months` : 'Not provided'}
- Employment Type: ${input.application.employment_type ?? 'Not provided'}
- Years Renting: ${input.application.years_renting}
- Previous Evictions: ${input.application.previous_evictions ? 'Yes' : 'No'}
- References: ${input.application.references.length > 0 ? input.application.references.map(r => `${r.name} (${r.relationship})`).join(', ') : 'None provided'}

PROPERTY:
- Monthly Rent: $${input.property.monthly_rent.toFixed(2)}
- Income-to-Rent Ratio: ${incomeRatio.toFixed(2)}x

Respond with ONLY valid JSON:
{"approved": boolean, "reasoning": "string explaining the decision", "risk_score": number 0-100 where 0 is no risk, "income_ratio": number, "flags": ["array", "of", "risk", "flags"], "confidence": number 0-1, "social_media_notes": null}`;

  const response = await withAITracking(
    { service: 'screening-agent', endpoint: 'application-screening' },
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
  );

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) {
    return FALLBACK_DECISION;
  }
  try {
    const parsed = JSON.parse(json) as ScreeningDecision;
    return {
      ...parsed,
      income_ratio: incomeRatio,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      risk_score: Math.max(0, Math.min(100, parsed.risk_score)),
      social_media_notes: null, // Fair Housing: never include social media analysis
    };
  } catch {
    return FALLBACK_DECISION;
  }
}
