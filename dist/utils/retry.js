export async function retry(fn, options = {}) {
    const { maxAttempts = 3, baseDelay = 1000, maxDelay = 30000, backoffMultiplier = 2, onRetry } = options;
    let lastError;
    let delay = baseDelay;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts)
                break;
            onRetry?.(attempt, lastError);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
    }
    throw lastError;
}
//# sourceMappingURL=retry.js.map