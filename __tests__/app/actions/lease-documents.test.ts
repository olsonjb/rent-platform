import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these are available inside vi.mock factory
const { mockRedirect, mockRevalidatePath, mockSupabase } = vi.hoisted(() => {
  const mockRedirect = vi.fn();
  const mockRevalidatePath = vi.fn();
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  };
  return { mockRedirect, mockRevalidatePath, mockSupabase };
});

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

import {
  uploadLeaseDocument,
  getLeaseDocument,
  getLeaseDocuments,
  confirmExtraction,
} from '@/app/actions/lease-documents';
import type { ExtractedLeaseData } from '@/lib/types';

function createChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'update', 'eq', 'ilike', 'order'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) => resolve(resolvedValue);
  return chain;
}

describe('lease-documents actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  describe('uploadLeaseDocument', () => {
    it('redirects to login when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const fd = new FormData();
      fd.set('file', new File(['pdf'], 'test.pdf', { type: 'application/pdf' }));

      await uploadLeaseDocument(fd).catch(() => {});
      expect(mockRedirect).toHaveBeenCalledWith('/auth/login');
    });

    it('rejects non-PDF files', async () => {
      const fd = new FormData();
      fd.set('file', new File(['txt'], 'test.txt', { type: 'text/plain' }));

      await expect(uploadLeaseDocument(fd)).rejects.toThrow('Only PDF files are accepted');
    });

    it('rejects files over 20MB', async () => {
      const bigBuffer = new ArrayBuffer(21 * 1024 * 1024);
      const fd = new FormData();
      fd.set('file', new File([bigBuffer], 'big.pdf', { type: 'application/pdf' }));

      await expect(uploadLeaseDocument(fd)).rejects.toThrow('20MB limit');
    });

    it('throws when no file provided', async () => {
      const fd = new FormData();
      await expect(uploadLeaseDocument(fd)).rejects.toThrow('No file provided');
    });
  });

  describe('getLeaseDocument', () => {
    it('returns document for valid owner', async () => {
      const doc = { id: 'doc-1', landlord_id: 'user-123', file_name: 'test.pdf' };
      const chain = createChain({ data: doc, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getLeaseDocument('doc-1');
      expect(result).toEqual(doc);
    });

    it('returns null on error', async () => {
      const chain = createChain({ data: null, error: { message: 'not found' } });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getLeaseDocument('bad-id');
      expect(result).toBeNull();
    });
  });

  describe('getLeaseDocuments', () => {
    it('returns list of documents', async () => {
      const docs = [
        { id: 'doc-1', file_name: 'lease1.pdf' },
        { id: 'doc-2', file_name: 'lease2.pdf' },
      ];
      const chain = createChain({ data: docs, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await getLeaseDocuments();
      expect(result).toEqual(docs);
    });
  });

  describe('confirmExtraction', () => {
    it('throws when document not found', async () => {
      const chain = createChain({ data: null, error: { message: 'not found' } });
      mockSupabase.from.mockReturnValue(chain);

      const data: ExtractedLeaseData = {
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

      await expect(confirmExtraction('bad-id', data)).rejects.toThrow('Document not found');
    });
  });
});
