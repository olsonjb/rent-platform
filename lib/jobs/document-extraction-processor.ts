import { createServiceClient } from '@/lib/supabase/service';
import { extractLeaseData } from '@/lib/agent/document-extraction';
import { createLogger } from '@/lib/logger';
import type { DocumentExtractionJob } from '@/lib/types';

const logger = createLogger('document-extraction-processor');

/** Exponential backoff: 2^attempts * 1000ms base. */
function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 1000, 60_000);
}

/**
 * Process pending document extraction jobs.
 * Claims a job, downloads the PDF, extracts data, stores results.
 * Returns the number of jobs processed.
 */
export async function processDocumentExtractionJobs(): Promise<number> {
  const supabase = createServiceClient();
  let processed = 0;

  // Find pending jobs that haven't exceeded max attempts
  const { data: jobs, error: fetchError } = await supabase
    .from('document_extraction_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);

  if (fetchError || !jobs || jobs.length === 0) {
    return 0;
  }

  for (const job of jobs as DocumentExtractionJob[]) {
    // Check backoff: skip if not enough time has passed since last attempt
    if (job.attempts > 0 && job.updated_at) {
      const nextAttemptAt = new Date(job.updated_at).getTime() + backoffMs(job.attempts);
      if (Date.now() < nextAttemptAt) continue;
    }

    // Claim the job
    const { error: claimError } = await supabase
      .from('document_extraction_jobs')
      .update({
        status: 'processing',
        claimed_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      })
      .eq('id', job.id)
      .eq('status', 'pending');

    if (claimError) {
      logger.warn({ jobId: job.id, error: claimError.message }, 'Failed to claim job');
      continue;
    }

    // Update document status
    await supabase
      .from('lease_documents')
      .update({ extraction_status: 'processing' })
      .eq('id', job.document_id);

    try {
      // Get document info
      const { data: doc, error: docError } = await supabase
        .from('lease_documents')
        .select('file_url, file_name')
        .eq('id', job.document_id)
        .single();

      if (docError || !doc) {
        throw new Error('Document not found');
      }

      // Download PDF from storage
      // Extract the path from the public URL
      const urlParts = doc.file_url.split('/lease-documents/');
      const storagePath = urlParts[urlParts.length - 1];

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('lease-documents')
        .download(storagePath);

      if (downloadError || !fileData) {
        throw new Error('Failed to download PDF from storage');
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());

      // Extract data
      const result = await extractLeaseData(buffer);

      if (result.success) {
        // Update document with extracted data
        await supabase
          .from('lease_documents')
          .update({
            extraction_status: 'completed',
            extracted_data: result.data,
          })
          .eq('id', job.document_id);

        // Mark job completed
        await supabase
          .from('document_extraction_jobs')
          .update({ status: 'completed' })
          .eq('id', job.id);
      } else {
        throw new Error(result.error ?? 'Extraction failed');
      }

      processed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ jobId: job.id, err }, 'Extraction job failed');

      const exceeded = job.attempts + 1 >= job.max_attempts;
      const newStatus = exceeded ? 'failed' : 'pending';

      await supabase
        .from('document_extraction_jobs')
        .update({
          status: newStatus,
          last_error: errorMessage,
        })
        .eq('id', job.id);

      // Update document status if max attempts exceeded
      if (exceeded) {
        await supabase
          .from('lease_documents')
          .update({ extraction_status: 'failed' })
          .eq('id', job.document_id);
      } else {
        await supabase
          .from('lease_documents')
          .update({ extraction_status: 'pending' })
          .eq('id', job.document_id);
      }
    }
  }

  return processed;
}
