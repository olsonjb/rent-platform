import { registerPrompt } from './index';
import { getModelConfig } from '../models';

const CREDIT_LABELS: Record<string, string> = {
  below_580: 'Below 580 (Poor)',
  '580_619': '580-619 (Fair)',
  '620_659': '620-659 (Good)',
  '660_699': '660-699 (Very Good)',
  '700_749': '700-749 (Excellent)',
  '750_plus': '750+ (Exceptional)',
};

export interface ScreeningPromptContext {
  fullName: string;
  creditScoreRange: string;
  monthlyIncome: number;
  employerName: string | null;
  employmentDurationMonths: number | null;
  employmentType: string | null;
  yearsRenting: number;
  previousEvictions: boolean;
  references: { name: string; phone: string; relationship: string }[];
  socialMediaLinks: string[];
  propertyAddress: string;
  monthlyRent: number;
  incomeRatio: number;
}

export function buildScreeningPrompt(ctx: ScreeningPromptContext): string {
  return `You are a tenant screening AI for residential rentals. Evaluate this rental application and provide an advisory recommendation. Your recommendation is NOT a final decision — a human landlord must review and approve or deny every application.

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
- Credit Score Range: ${CREDIT_LABELS[ctx.creditScoreRange] ?? ctx.creditScoreRange}
- Monthly Income: $${ctx.monthlyIncome.toFixed(2)}
- Employer: ${ctx.employerName ?? 'Not provided'}
- Employment Duration: ${ctx.employmentDurationMonths != null ? `${ctx.employmentDurationMonths} months` : 'Not provided'}
- Employment Type: ${ctx.employmentType ?? 'Not provided'}
- Years Renting: ${ctx.yearsRenting}
- Previous Evictions: ${ctx.previousEvictions ? 'Yes' : 'No'}
- References: ${ctx.references.length > 0 ? ctx.references.map(r => `${r.name} (${r.relationship})`).join(', ') : 'None provided'}

PROPERTY:
- Monthly Rent: $${ctx.monthlyRent.toFixed(2)}
- Income-to-Rent Ratio: ${ctx.incomeRatio.toFixed(2)}x

Respond with ONLY valid JSON:
{"approved": boolean, "reasoning": "string explaining the decision", "risk_score": number 0-100 where 0 is no risk, "income_ratio": number, "flags": ["array", "of", "risk", "flags"], "confidence": number 0-1, "social_media_notes": null}`;
}

const screeningConfig = getModelConfig('screening');

registerPrompt({
  name: 'screening',
  version: '1.0.0',
  template: (vars) => buildScreeningPrompt({
    fullName: vars.fullName,
    creditScoreRange: vars.creditScoreRange,
    monthlyIncome: Number(vars.monthlyIncome),
    employerName: vars.employerName || null,
    employmentDurationMonths: vars.employmentDurationMonths ? Number(vars.employmentDurationMonths) : null,
    employmentType: vars.employmentType || null,
    yearsRenting: Number(vars.yearsRenting),
    previousEvictions: vars.previousEvictions === 'true',
    references: JSON.parse(vars.references || '[]'),
    socialMediaLinks: JSON.parse(vars.socialMediaLinks || '[]'),
    propertyAddress: vars.propertyAddress,
    monthlyRent: Number(vars.monthlyRent),
    incomeRatio: Number(vars.incomeRatio),
  }),
  model: screeningConfig.model,
  maxTokens: screeningConfig.maxTokens,
  temperature: screeningConfig.temperature,
});
