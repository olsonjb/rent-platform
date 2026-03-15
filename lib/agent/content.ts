import Anthropic from '@anthropic-ai/sdk';
import { withAITracking } from '@/lib/ai-metrics';
import type { AIContent } from '@/lib/types';
export type { AIContent };

interface ContentInput {
  property: {
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
  };
  suggestedRent: number;
}

const client = new Anthropic();

export async function generateListingContent(input: ContentInput): Promise<AIContent> {
  const prompt = `You are a property marketing AI. Generate a compelling rental listing.

Property:
- Address: ${input.property.address}
- Location: ${input.property.city ?? 'Unknown'}, ${input.property.state ?? 'Unknown'} ${input.property.zip ?? ''}
- Bedrooms: ${input.property.bedrooms ?? 'Studio/Unknown'}
- Bathrooms: ${input.property.bathrooms ?? 'Unknown'}
- Sqft: ${input.property.sqft ? `${input.property.sqft} sq ft` : 'Not specified'}
- Rent: $${input.suggestedRent}/mo

Generate:
1. A catchy listing title (max 80 chars)
2. A compelling description (2-3 paragraphs)
3. 3-5 highlights (short bullet points)

Respond with ONLY valid JSON:
{"title": "string", "description": "string", "highlights": ["string", ...]}`;

  const response = await withAITracking(
    { service: 'listing-agent', endpoint: 'content-generation' },
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
  );

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) {
    return { title: `${input.property.address} for Rent`, description: 'Rental property available.', highlights: [] };
  }
  try {
    return JSON.parse(json) as AIContent;
  } catch {
    return { title: `${input.property.address} for Rent`, description: 'Rental property available.', highlights: [] };
  }
}
