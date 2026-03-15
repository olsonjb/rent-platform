import { NextRequest } from 'next/server';
import { generateMonthlyInvoices } from '@/lib/billing/invoices';
import { processScheduledPayments } from '@/lib/billing/process-payments';
import { apiSuccess, apiError } from '@/lib/api-response';
import { createLogger, withCorrelationId } from '@/lib/logger';
import { getCorrelationId } from '@/lib/correlation';

const baseLogger = createLogger('cron-process-rent');

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const logger = withCorrelationId(baseLogger, correlationId);

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401, correlationId, 'UNAUTHORIZED');
  }

  try {
    logger.info('Starting rent processing cron');

    const invoiceResult = await generateMonthlyInvoices();
    const paymentResult = await processScheduledPayments();

    const summary = {
      invoices: {
        created: invoiceResult.created,
        skipped: invoiceResult.skipped,
      },
      payments: {
        processed: paymentResult.processed,
        succeeded: paymentResult.succeeded,
        failed: paymentResult.failed,
      },
    };

    logger.info({ summary }, 'Rent processing cron complete');
    return apiSuccess(summary, correlationId);
  } catch (error) {
    logger.error({ err: error }, 'Rent processing cron error');
    return apiError(
      error instanceof Error ? error.message : 'Internal error',
      500,
      correlationId,
    );
  }
}
