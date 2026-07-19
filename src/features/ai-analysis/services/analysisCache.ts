/**
 * In-memory analysis response cache.
 *
 * Keyed by SHA-256(datasetHash + "|" + sanitizedQuestion).
 * Stored in a module-level Map — persists for the lifetime of the Node.js
 * process (session-scoped cache, per the approved design).
 * Note: In a serverless environment (like Vercel), this in-memory Map will
 * reset on cold starts and will not be shared across concurrent lambda instances.
 *
 * TTL: 30 minutes. Expired entries are evicted on read.
 * No size cap — adequate for single-session usage (≤500 gates × ~6 questions).
 */

import type { AnalysisResponse } from "@/types/analysis";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Time-to-live for a cached analysis result. */
const CACHE_TTL_MS = 30 * 60 * 1_000; // 30 minutes

// ─── Storage ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: AnalysisResponse;
  expiresAt: number;
}

/** Module-level cache — one instance per Node.js worker process. */
const cache = new Map<string, CacheEntry>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieves a cached analysis result, or null if absent / expired.
 * Expired entries are evicted on read (lazy eviction).
 */
export function getCachedAnalysis(key: string): AnalysisResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

/**
 * Stores an analysis result in the cache with a 30-minute TTL.
 */
export function setCachedAnalysis(key: string, result: AnalysisResponse): void {
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Returns the current number of live (non-expired) cache entries. */
export function getCacheSize(): number {
  const now = Date.now();
  let count = 0;
  for (const entry of cache.values()) {
    if (entry.expiresAt > now) count++;
  }
  return count;
}

/** Clears the entire cache. Used in tests and on dataset replacement. */
export function clearAnalysisCache(): void {
  cache.clear();
}
