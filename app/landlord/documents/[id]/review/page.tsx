import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getLeaseDocument } from '@/app/actions/lease-documents';
import { ReviewForm } from './review-form';
import type { ExtractedLeaseData } from '@/lib/types';

const EMPTY_EXTRACTION: ExtractedLeaseData = {
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

export default async function ReviewExtractionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getLeaseDocument(id);
  if (!doc) redirect('/landlord/documents/upload');

  const isPending = doc.extraction_status === 'pending' || doc.extraction_status === 'processing';
  const hasFailed = doc.extraction_status === 'failed';
  const extractedData = doc.extracted_data ?? EMPTY_EXTRACTION;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/landlord/documents/upload"
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          &larr; Back to upload
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
        Review extraction: {doc.file_name}
      </h1>

      {isPending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Extraction is in progress. Refresh the page in a moment to see results.
        </div>
      )}

      {hasFailed && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Extraction failed. You can try re-extracting or fill in the fields manually.
        </div>
      )}

      <ReviewForm
        documentId={doc.id}
        initialData={extractedData}
        fileUrl={doc.file_url}
      />
    </div>
  );
}
