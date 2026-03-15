import Anthropic from '@anthropic-ai/sdk';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (dataBuffer: Buffer) => Promise<{ text: string }>;
import { withAITracking } from '@/lib/ai-metrics';
import { getModelConfig } from '@/lib/ai/models';
import { extractJson } from '@/lib/ai/extractors';
import { createLogger } from '@/lib/logger';
import type { ExtractedLeaseData } from '@/lib/types';

const logger = createLogger('document-extraction');
const client = new Anthropic();

/** Maximum pages of text to send to Claude (context window safety). */
const MAX_PAGES = 50;
const APPROX_CHARS_PER_PAGE = 3000;

const FALLBACK_EXTRACTION: ExtractedLeaseData = {
  tenant_names: [],
  address: { street: null, city: null, state: null, zip: null },
  monthly_rent: null,
  lease_start_date: null,
  lease_end_date: null,
  security_deposit: null,
  pet_policy: null,
  parking_policy: null,
  quiet_hours: null,
  late_fee_terms: null,
  early_termination_terms: null,
  contact_info: { name: null, phone: null, email: null },
};

function buildExtractionPrompt(leaseText: string): string {
  return `You are a lease document extraction AI. Extract structured data from the following lease text. If a field cannot be found, use null.

Extract the following fields:
- tenant_names: array of tenant full names on the lease
- address: { street, city, state, zip } of the property
- monthly_rent: number (dollars, no cents formatting)
- lease_start_date: ISO date string (YYYY-MM-DD)
- lease_end_date: ISO date string (YYYY-MM-DD)
- security_deposit: number (dollars)
- pet_policy: brief summary string
- parking_policy: brief summary string
- quiet_hours: brief summary string
- late_fee_terms: brief summary string
- early_termination_terms: brief summary string
- contact_info: { name, phone, email } of landlord/manager

LEASE TEXT:
${leaseText}

Respond with ONLY valid JSON matching this exact structure:
{"tenant_names": ["string"], "address": {"street": "string|null", "city": "string|null", "state": "string|null", "zip": "string|null"}, "monthly_rent": null, "lease_start_date": null, "lease_end_date": null, "security_deposit": null, "pet_policy": null, "parking_policy": null, "quiet_hours": null, "late_fee_terms": null, "early_termination_terms": null, "contact_info": {"name": null, "phone": null, "email": null}}`;
}

export interface ExtractionResult {
  success: boolean;
  data: ExtractedLeaseData;
  error?: string;
}

/**
 * Extract structured lease data from a PDF buffer.
 * Returns extracted data on success, or fallback with error on failure.
 */
export async function extractLeaseData(pdfBuffer: Buffer): Promise<ExtractionResult> {
  let text: string;

  try {
    const parsed = await pdfParse(pdfBuffer);
    text = parsed.text;
  } catch (err) {
    logger.error({ err }, 'Failed to parse PDF');
    return {
      success: false,
      data: FALLBACK_EXTRACTION,
      error: 'Failed to parse PDF file',
    };
  }

  // Scanned document with no extractable text
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      data: FALLBACK_EXTRACTION,
      error: 'Unable to extract text from PDF — document may be scanned/image-based',
    };
  }

  // Truncate to max pages for context window safety
  const maxChars = MAX_PAGES * APPROX_CHARS_PER_PAGE;
  const truncatedText = text.length > maxChars ? text.slice(0, maxChars) : text;

  const prompt = buildExtractionPrompt(truncatedText);
  const modelConfig = getModelConfig('extraction');

  try {
    const response = await withAITracking(
      { service: 'document-extraction', endpoint: 'lease-extraction' },
      () =>
        client.messages.create({
          model: modelConfig.model,
          max_tokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
          messages: [{ role: 'user', content: prompt }],
        }),
    );

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = extractJson<ExtractedLeaseData | null>(responseText, null);

    if (!parsed) {
      return {
        success: false,
        data: FALLBACK_EXTRACTION,
        error: 'Failed to parse AI extraction response',
      };
    }

    // Ensure required structure even with partial extraction
    return {
      success: true,
      data: {
        tenant_names: parsed.tenant_names ?? [],
        address: {
          street: parsed.address?.street ?? null,
          city: parsed.address?.city ?? null,
          state: parsed.address?.state ?? null,
          zip: parsed.address?.zip ?? null,
        },
        monthly_rent: parsed.monthly_rent ?? null,
        lease_start_date: parsed.lease_start_date ?? null,
        lease_end_date: parsed.lease_end_date ?? null,
        security_deposit: parsed.security_deposit ?? null,
        pet_policy: parsed.pet_policy ?? null,
        parking_policy: parsed.parking_policy ?? null,
        quiet_hours: parsed.quiet_hours ?? null,
        late_fee_terms: parsed.late_fee_terms ?? null,
        early_termination_terms: parsed.early_termination_terms ?? null,
        contact_info: {
          name: parsed.contact_info?.name ?? null,
          phone: parsed.contact_info?.phone ?? null,
          email: parsed.contact_info?.email ?? null,
        },
      },
    };
  } catch (err) {
    logger.error({ err }, 'AI extraction failed');
    return {
      success: false,
      data: FALLBACK_EXTRACTION,
      error: 'AI extraction request failed',
    };
  }
}
