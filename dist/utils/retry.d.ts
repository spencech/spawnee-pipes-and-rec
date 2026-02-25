export interface RetryOptions {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
}
export declare function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
