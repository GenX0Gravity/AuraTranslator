/**
 * Exponential backoff retry utility for API calls.
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  retryOn?: (error: unknown) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 500,
  maxDelay: 10000,
  factor: 2,
  retryOn: () => true,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === opts.maxRetries || !opts.retryOn(error)) {
        break;
      }
      await sleep(delay + Math.random() * 100); // Jitter
      delay = Math.min(delay * opts.factor, opts.maxDelay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
