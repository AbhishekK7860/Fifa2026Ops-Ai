/**
 * In-memory IP-based rate limiter — sliding window algorithm.
 *
 * Uses a module-level Map per namespace that persists across requests within 
 * the same Node.js process. Note: In a serverless environment (like Vercel), 
 * this in-memory Map will reset on cold starts.
 */

// ─── Storage ──────────────────────────────────────────────────────────────────

/** Maps Namespace -> (IP -> Array of request timestamps) */
const stores = new Map<string, Map<string, number[]>>();

function getStore(namespace: string): Map<string, number[]> {
  if (!stores.has(namespace)) {
    stores.set(namespace, new Map<string, number[]>());
  }
  return stores.get(namespace)!;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window (0 when denied). */
  remaining: number;
  /**
   * Milliseconds until the oldest request in the window expires.
   * 0 when allowed. Use this value for the Retry-After response header.
   */
  retryAfterMs: number;
  /** Unix epoch time in milliseconds when the limit fully resets */
  resetAt: number;
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

/**
 * Checks whether the given IP is within the rate limit for a specific namespace.
 *
 * Side-effect: records the current timestamp for the IP if allowed.
 * Callers must check `result.allowed` before proceeding.
 *
 * @param namespace - An identifier for the limit (e.g., "analyze-burst")
 * @param ip - The client IP address
 * @param maxRequests - Maximum requests allowed per window
 * @param windowMs - Duration of the sliding window in milliseconds
 */
export function checkRateLimit(
  namespace: string,
  ip: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;
  const store = getStore(namespace);

  // Prune expired entries
  const timestamps = (store.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    const resetAt = oldest + windowMs;
    return { allowed: false, remaining: 0, retryAfterMs, resetAt };
  }

  // Record this request
  timestamps.push(now);
  store.set(ip, timestamps);

  const oldest = timestamps[0];
  const resetAt = oldest + windowMs;

  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
    retryAfterMs: 0,
    resetAt,
  };
}

/**
 * Returns the Retry-After header value in whole seconds (ceil).
 */
export function retryAfterSeconds(retryAfterMs: number): number {
  return Math.ceil(retryAfterMs / 1000);
}
