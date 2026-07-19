/**
 * Hash utilities — SHA-256 via Web Crypto API.
 * Available in both Node.js (v19+) and Edge runtimes without extra dependencies.
 */

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

/**
 * Returns the lowercase hex SHA-256 digest of the given string.
 * Async because Web Crypto's `subtle.digest` is always async.
 */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Analysis cache key ───────────────────────────────────────────────────────

/**
 * Builds the cache key for a gate+question analysis request.
 * Format: SHA-256(datasetHash + "|" + sanitizedQuestion)
 *
 * Both inputs are controlled by us at call time (the dataset hash is computed
 * from the CSV content; the question has already been sanitized and PII-scrubbed
 * before this function is called).
 */
export async function buildAnalysisCacheKey(
  datasetHash: string,
  sanitizedQuestion: string
): Promise<string> {
  return sha256(`${datasetHash}|${sanitizedQuestion}`);
}

/**
 * Computes a SHA-256 dataset hash from the raw CSV content.
 * Called once when the file is validated and stored alongside the dataset meta.
 */
export async function hashDataset(csvContent: string): Promise<string> {
  return sha256(csvContent);
}
