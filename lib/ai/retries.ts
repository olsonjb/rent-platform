/** Error status codes that warrant a retry. */
const RETRYABLE_STATUS_CODES = [429, 529];

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return RETRYABLE_STATUS_CODES.includes(status);
  }
  return false;
}

/**
 * Retry a function with exponential backoff on retryable Anthropic errors (429/529).
 *
 * @param fn - Async function to execute
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds (default: 1000)
 * @returns Result of the function
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === maxAttempts - 1) {
        throw error;
      }

      const delayMs = initialDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
