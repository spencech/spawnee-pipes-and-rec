export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000, maxDelay = 30000, backoffMultiplier = 2, onRetry } = options;
  let lastError: Error | undefined;
  let delay = baseDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxAttempts) break;
      onRetry?.(attempt, lastError);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

