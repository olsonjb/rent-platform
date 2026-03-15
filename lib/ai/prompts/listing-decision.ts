import { registerPrompt } from './index';
import { getModelConfig } from '../models';

export interface ListingDecisionContext {
  propertyAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  currentListedRent: number;
  leaseMonthlyRent: number;
  daysLeft: number;
  leaseEndDate: string;
  tenantName: string;
  renewalOffered: boolean;
}

export function buildListingDecisionPrompt(ctx: ListingDecisionContext): string {
  return `You are a property management AI. Decide whether to create a rental listing for this property.

Property:
- Address: ${ctx.propertyAddress}
- Location: ${ctx.city ?? 'Unknown'}, ${ctx.state ?? 'Unknown'} ${ctx.zip ?? ''}
- Bedrooms: ${ctx.bedrooms ?? 'Unknown'}
- Bathrooms: ${ctx.bathrooms ?? 'Unknown'}
- Sqft: ${ctx.sqft ?? 'Unknown'}
- Current listed rent: $${ctx.currentListedRent}/mo

Lease:
- Current rent: $${ctx.leaseMonthlyRent}/mo
- Expires in ${ctx.daysLeft} days (${ctx.leaseEndDate})
- Tenant: ${ctx.tenantName}
- Renewal offered: ${ctx.renewalOffered ? 'Yes' : 'No'}

Decide:
1. Should we create a listing? (Consider: days until expiry, whether renewal was offered)
2. What rent should we suggest? (Consider current rent, market positioning)
3. How urgent is this? (high = <14 days, medium = 14-21 days, low = 21+ days)

Respond with ONLY valid JSON:
{"should_list": boolean, "reasoning": "string", "suggested_rent": number, "urgency": "high"|"medium"|"low"}`;
}

const decisionConfig = getModelConfig('decision');

registerPrompt({
  name: 'listing-decision',
  version: '1.0.0',
  template: (vars) => buildListingDecisionPrompt({
    propertyAddress: vars.propertyAddress,
    city: vars.city || null,
    state: vars.state || null,
    zip: vars.zip || null,
    bedrooms: vars.bedrooms ? Number(vars.bedrooms) : null,
    bathrooms: vars.bathrooms ? Number(vars.bathrooms) : null,
    sqft: vars.sqft ? Number(vars.sqft) : null,
    currentListedRent: Number(vars.currentListedRent),
    leaseMonthlyRent: Number(vars.leaseMonthlyRent),
    daysLeft: Number(vars.daysLeft),
    leaseEndDate: vars.leaseEndDate,
    tenantName: vars.tenantName,
    renewalOffered: vars.renewalOffered === 'true',
  }),
  model: decisionConfig.model,
  maxTokens: decisionConfig.maxTokens,
  temperature: decisionConfig.temperature,
});
