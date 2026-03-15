import { registerPrompt } from './index';
import { getModelConfig } from '../models';

export interface ListingContentContext {
  propertyAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  suggestedRent: number;
}

export function buildListingContentPrompt(ctx: ListingContentContext): string {
  return `You are a property marketing AI. Generate a compelling rental listing.

Property:
- Address: ${ctx.propertyAddress}
- Location: ${ctx.city ?? 'Unknown'}, ${ctx.state ?? 'Unknown'} ${ctx.zip ?? ''}
- Bedrooms: ${ctx.bedrooms ?? 'Studio/Unknown'}
- Bathrooms: ${ctx.bathrooms ?? 'Unknown'}
- Sqft: ${ctx.sqft ? `${ctx.sqft} sq ft` : 'Not specified'}
- Rent: $${ctx.suggestedRent}/mo

Generate:
1. A catchy listing title (max 80 chars)
2. A compelling description (2-3 paragraphs)
3. 3-5 highlights (short bullet points)

Respond with ONLY valid JSON:
{"title": "string", "description": "string", "highlights": ["string", ...]}`;
}

const contentConfig = getModelConfig('content');

registerPrompt({
  name: 'listing-content',
  version: '1.0.0',
  template: (vars) => buildListingContentPrompt({
    propertyAddress: vars.propertyAddress,
    city: vars.city || null,
    state: vars.state || null,
    zip: vars.zip || null,
    bedrooms: vars.bedrooms ? Number(vars.bedrooms) : null,
    bathrooms: vars.bathrooms ? Number(vars.bathrooms) : null,
    sqft: vars.sqft ? Number(vars.sqft) : null,
    suggestedRent: Number(vars.suggestedRent),
  }),
  model: contentConfig.model,
  maxTokens: contentConfig.maxTokens,
  temperature: contentConfig.temperature,
});
