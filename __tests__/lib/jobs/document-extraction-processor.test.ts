import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase service client
const mockFrom = vi.fn();
const mockStorage = {
  from: vi.fn(),
};
const mockSupabase = {
  from: mockFrom,
  storage: mockStorage,
};

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => mockSupabase),
}));

// Mock document extraction
const mockExtractLeaseData = vi.fn();
vi.mock('@/lib/agent/document-extraction', () => ({
  extractLeaseData: (...args: unknown[]) => mockExtractLeaseData(...args),
}));

import { processDocumentExtractionJobs } from '@/lib/jobs/document-extraction-processor';

function createChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'eq', 'order', 'limit'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) => resolve(resolvedValue);
  return chain;
}

describe('processDocumentExtractionJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when no pending jobs', async () => {
    const chain = createChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await processDocumentExtractionJobs();
    expect(result).toBe(0);
  });

  it('returns 0 when fetch errors', async () => {
    const chain = createChain({ data: null, error: { message: 'db error' } });
    mockFrom.mockReturnValue(chain);

    const result = await processDocumentExtractionJobs();
    expect(result).toBe(0);
  });

  it('processes a pending job successfully', async () => {
    const job = {
      id: 'job-1',
      document_id: 'doc-1',
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      claimed_at: null,
    };

    // First call: fetch jobs
    const fetchChain = createChain({ data: [job], error: null });
    // Subsequent calls: claim, update doc, get doc info, update completed
    const updateChain = createChain({ data: null, error: null });
    const docChain = createChain({
      data: { file_url: 'https://storage.test/lease-documents/user-1/test.pdf', file_name: 'test.pdf' },
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fetchChain;
      if (callCount === 4) return docChain; // doc lookup
      return updateChain;
    });

    // Mock storage download
    const arrayBuffer = new ArrayBuffer(10);
    mockStorage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: { arrayBuffer: () => arrayBuffer }, error: null }),
    });

    // Mock extraction success
    mockExtractLeaseData.mockResolvedValue({
      success: true,
      data: {
        tenant_names: ['Jane Doe'],
        address: { street: '123 Main', city: 'SLC', state: 'UT', zip: '84101' },
        monthly_rent: 1500,
        lease_start_date: '2026-01-01',
        lease_end_date: '2026-12-31',
        security_deposit: 1500,
        pet_policy: null,
        parking_policy: null,
        quiet_hours: null,
        late_fee_terms: null,
        early_termination_terms: null,
        contact_info: { name: null, phone: null, email: null },
      },
    });

    const result = await processDocumentExtractionJobs();
    expect(result).toBe(1);
    expect(mockExtractLeaseData).toHaveBeenCalled();
  });

  it('marks job as failed after max attempts', async () => {
    const job = {
      id: 'job-1',
      document_id: 'doc-1',
      status: 'pending',
      attempts: 2, // Already at 2, max is 3, so next attempt (3) will exceed
      max_attempts: 3,
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date(0).toISOString(), // Old date so backoff is satisfied
      claimed_at: null,
    };

    const fetchChain = createChain({ data: [job], error: null });
    const updateChain = createChain({ data: null, error: null });
    const docChain = createChain({
      data: { file_url: 'https://storage.test/lease-documents/user-1/test.pdf', file_name: 'test.pdf' },
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fetchChain;
      if (callCount === 4) return docChain;
      return updateChain;
    });

    mockStorage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: { arrayBuffer: () => new ArrayBuffer(10) }, error: null }),
    });

    // Mock extraction failure
    mockExtractLeaseData.mockResolvedValue({
      success: false,
      data: { tenant_names: [] },
      error: 'Extraction failed',
    });

    const result = await processDocumentExtractionJobs();
    // Job fails, not counted as processed
    expect(result).toBe(0);
  });

  it('respects exponential backoff timing', async () => {
    const recentUpdate = new Date().toISOString();
    const job = {
      id: 'job-1',
      document_id: 'doc-1',
      status: 'pending',
      attempts: 2, // Would need 4000ms backoff
      max_attempts: 3,
      last_error: 'previous error',
      created_at: new Date().toISOString(),
      updated_at: recentUpdate, // Just updated, should be skipped
      claimed_at: null,
    };

    const fetchChain = createChain({ data: [job], error: null });
    mockFrom.mockReturnValue(fetchChain);

    const result = await processDocumentExtractionJobs();
    // Should skip due to backoff
    expect(result).toBe(0);
    expect(mockExtractLeaseData).not.toHaveBeenCalled();
  });
});
