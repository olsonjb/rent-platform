import Anthropic from '@anthropic-ai/sdk';
import { withAITracking } from '@/lib/ai-metrics';
import { getModelConfig } from '@/lib/ai/models';
import { buildListingContentPrompt } from '@/lib/ai/prompts/listing-content';
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
  const prompt = buildListingContentPrompt({
    propertyAddress: input.property.address,
    city: input.property.city,
    state: input.property.state,
    zip: input.property.zip,
    bedrooms: input.property.bedrooms,
    bathrooms: input.property.bathrooms,
    sqft: input.property.sqft,
    suggestedRent: input.suggestedRent,
  });

  const modelConfig = getModelConfig('content');

  const response = await withAITracking(
    { service: 'listing-agent', endpoint: 'content-generation' },
    () =>
      client.messages.create({
        model: modelConfig.model,
        max_tokens: modelConfig.maxTokens,
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
