import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setMockAnthropicResponse,
  resetAnthropicMock,
  installAnthropicMock,
} from '../../mocks/anthropic';

installAnthropicMock();

const { mockPdfParseFn } = vi.hoisted(() => {
  const mockPdfParseFn = vi.fn();
  return { mockPdfParseFn };
});

vi.mock('pdf-parse', () => ({ default: mockPdfParseFn }));

vi.mock('@/lib/ai-metrics', () => ({
  withAITracking: vi.fn((_params: unknown, fn: () => unknown) => fn()),
}));

import { extractLeaseData } from '@/lib/agent/document-extraction';

const SAMPLE_LEASE_TEXT = `
RESIDENTIAL LEASE AGREEMENT

This Lease Agreement is entered into on January 1, 2026, between
John Smith ("Landlord") and Jane Doe, Bob Doe ("Tenants").

PROPERTY: 123 Main Street, Salt Lake City, UT 84101

TERM: The lease term begins on February 1, 2026 and ends on January 31, 2027.

RENT: Tenant agrees to pay $1,500.00 per month.

SECURITY DEPOSIT: $1,500.00

PET POLICY: No pets allowed without written approval. $500 pet deposit required.

PARKING: One assigned parking spot included.

QUIET HOURS: 10:00 PM to 7:00 AM.

LATE FEES: $50 late fee if rent is not received by the 5th of each month.

EARLY TERMINATION: Tenant may terminate with 60 days written notice and 2 months rent penalty.

LANDLORD CONTACT:
John Smith
Phone: (801) 555-0100
Email: john@example.com
`;

const FULL_EXTRACTION = {
  tenant_names: ['Jane Doe', 'Bob Doe'],
  address: {
    street: '123 Main Street',
    city: 'Salt Lake City',
    state: 'UT',
    zip: '84101',
  },
  monthly_rent: 1500,
  lease_start_date: '2026-02-01',
  lease_end_date: '2027-01-31',
  security_deposit: 1500,
  pet_policy: 'No pets allowed without written approval. $500 pet deposit required.',
  parking_policy: 'One assigned parking spot included.',
  quiet_hours: '10:00 PM to 7:00 AM',
  late_fee_terms: '$50 late fee if rent is not received by the 5th of each month.',
  early_termination_terms: '60 days written notice and 2 months rent penalty.',
  contact_info: {
    name: 'John Smith',
    phone: '(801) 555-0100',
    email: 'john@example.com',
  },
};

describe('extractLeaseData', () => {
  beforeEach(() => {
    resetAnthropicMock();
    mockPdfParseFn.mockReset();
  });

  it('extracts full lease data on happy path', async () => {
    mockPdfParseFn.mockResolvedValue({ text: SAMPLE_LEASE_TEXT });
    setMockAnthropicResponse(JSON.stringify(FULL_EXTRACTION));

    const result = await extractLeaseData(Buffer.from('fake-pdf'));

    expect(result.success).toBe(true);
    expect(result.data.tenant_names).toEqual(['Jane Doe', 'Bob Doe']);
    expect(result.data.monthly_rent).toBe(1500);
    expect(result.data.address.city).toBe('Salt Lake City');
    expect(result.data.lease_start_date).toBe('2026-02-01');
    expect(result.data.lease_end_date).toBe('2027-01-31');
    expect(result.error).toBeUndefined();
  });

  it('handles partial extraction (missing fields)', async () => {
    mockPdfParseFn.mockResolvedValue({ text: SAMPLE_LEASE_TEXT });
    setMockAnthropicResponse(
      JSON.stringify({
        tenant_names: ['Jane Doe'],
        address: { street: '123 Main St', city: null, state: null, zip: null },
        monthly_rent: 1500,
      }),
    );

    const result = await extractLeaseData(Buffer.from('fake-pdf'));

    expect(result.success).toBe(true);
    expect(result.data.tenant_names).toEqual(['Jane Doe']);
    expect(result.data.monthly_rent).toBe(1500);
    expect(result.data.lease_start_date).toBeNull();
    expect(result.data.pet_policy).toBeNull();
    expect(result.data.contact_info.name).toBeNull();
  });

  it('returns error for scanned/empty PDF', async () => {
    mockPdfParseFn.mockResolvedValue({ text: '' });

    const result = await extractLeaseData(Buffer.from('fake-pdf'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('scanned');
    expect(result.data.tenant_names).toEqual([]);
  });

  it('returns error when pdf-parse throws', async () => {
    mockPdfParseFn.mockRejectedValue(new Error('Corrupt PDF'));

    const result = await extractLeaseData(Buffer.from('fake-pdf'));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to parse PDF file');
  });

  it('returns error on unparseable AI response', async () => {
    mockPdfParseFn.mockResolvedValue({ text: SAMPLE_LEASE_TEXT });
    setMockAnthropicResponse('This is not valid JSON at all');

    const result = await extractLeaseData(Buffer.from('fake-pdf'));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to parse AI extraction response');
  });

  it('truncates long documents', async () => {
    const longText = 'A'.repeat(200000);
    mockPdfParseFn.mockResolvedValue({ text: longText });
    setMockAnthropicResponse(JSON.stringify(FULL_EXTRACTION));

    const result = await extractLeaseData(Buffer.from('fake-pdf'));

    expect(result.success).toBe(true);
  });
});
