"use strict";
/**
 * In-memory IP-based rate limiter — sliding window algorithm.
 *
 * Limits each IP to MAX_REQUESTS requests per WINDOW_MS milliseconds.
 * Uses a module-level Map that persists across requests within the same
 * Node.js process (one Map per worker; adequate for a single-instance deployment).
 *
 * On breach: callers should return HTTP 429 with a Retry-After header.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMIT_MAX_REQUESTS = exports.RATE_LIMIT_WINDOW_MS = void 0;
exports.checkRateLimit = checkRateLimit;
exports.retryAfterSeconds = retryAfterSeconds;
// ─── Constants ────────────────────────────────────────────────────────────────
/** Duration of the sliding window in milliseconds. */
exports.RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
/** Maximum requests allowed per IP per window. */
exports.RATE_LIMIT_MAX_REQUESTS = 10;
// ─── Storage ──────────────────────────────────────────────────────────────────
/**
 * Maps IP address → array of request timestamps (in ms) within the current window.
 * Entries are pruned on each request to avoid unbounded growth.
 */
const requestLog = new Map();
// ─── Rate limiter ─────────────────────────────────────────────────────────────
/**
 * Checks whether the given IP is within the rate limit.
 *
 * Side-effect: records the current timestamp for the IP if allowed.
 * Callers must check `result.allowed` before proceeding with the request.
 *
 * @param ip - The client IP address (use x-forwarded-for first segment)
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - exports.RATE_LIMIT_WINDOW_MS;
    // Prune expired entries
    const timestamps = (requestLog.get(ip) ?? []).filter((t) => t > windowStart);
    if (timestamps.length >= exports.RATE_LIMIT_MAX_REQUESTS) {
        // Calculate when the oldest entry will fall out of the window
        const oldest = timestamps[0];
        const retryAfterMs = oldest + exports.RATE_LIMIT_WINDOW_MS - now;
        return { allowed: false, remaining: 0, retryAfterMs };
    }
    // Record this request
    timestamps.push(now);
    requestLog.set(ip, timestamps);
    return {
        allowed: true,
        remaining: exports.RATE_LIMIT_MAX_REQUESTS - timestamps.length,
        retryAfterMs: 0,
    };
}
/**
 * Returns the Retry-After header value in whole seconds (ceil).
 * Used to build the 429 response header.
 */
function retryAfterSeconds(retryAfterMs) {
    return Math.ceil(retryAfterMs / 1000);
}
