/**
 * Error sanitizer — ensures no raw stack traces, error objects, or internal
 * path information are ever surfaced to the client.
 *
 * Rule: ALL errors in route handlers must pass through one of these functions
 * before being included in an HTTP response body.
 */

// ─── Unexpected / unhandled errors ───────────────────────────────────────────

/**
 * Sanitizes an unknown caught error for client-safe consumption.
 *
 * - Logs the full error (including stack) server-side.
 * - Returns only a short, opaque user-facing message — never a stack trace,
 *   file path, or internal error detail.
 */
export function sanitizeUnexpectedError(error: unknown): string {
  // Full error logged server-side only
  console.error("[unexpected error]", error);
  return "An unexpected error occurred. Please try again.";
}

// ─── Route handler helpers ────────────────────────────────────────────────────

/**
 * Returns a sanitized JSON error response body for route handlers.
 * The `fallbackMessage` is what the client sees — it must be a safe,
 * human-readable message with no internal detail.
 */
export function safeErrorBody(
  error: unknown,
  fallbackMessage: string
): { error: string } {
  console.error("[route error]", error);
  return { error: fallbackMessage };
}

/**
 * Creates a sanitized error Response for use in Next.js Route Handlers.
 *
 * @param error - The caught error (logged server-side, never forwarded)
 * @param clientMessage - Safe, human-readable message for the response body
 * @param status - HTTP status code (default 500)
 */
export function sanitizedErrorResponse(
  error: unknown,
  clientMessage: string,
  status = 500
): Response {
  console.error(`[route error ${status}]`, error);
  return Response.json({ error: clientMessage }, { status });
}
