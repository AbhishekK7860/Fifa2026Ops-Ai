import { z } from "zod";

// ─── File upload constraints ──────────────────────────────────────────────────

/** Maximum CSV file size enforced server-side. Client-side check is UX only. */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Maximum number of data rows (excluding header). */
export const MAX_CSV_ROWS = 500;

/** Required file encoding. */
export const REQUIRED_ENCODING = "UTF-8";

/**
 * Accepted MIME types for CSV uploads.
 * Used for both client-side (File.type) and server-side (buffer inspection) checks.
 */
export const ACCEPTED_MIME_TYPES = [
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

// ─── Upload metadata schema ───────────────────────────────────────────────────

/**
 * Zod schema for upload metadata validated at the server-side boundary.
 * Applied after physical MIME inspection and before the CSV is parsed.
 */
export const uploadMetaSchema = z.object({
  filename: z.string().min(1, "Filename cannot be empty"),
  sizeBytes: z
    .number()
    .max(
      MAX_FILE_SIZE_BYTES,
      `File must not exceed ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`
    ),
  mimeType: z.enum(["text/csv", "text/plain", "application/vnd.ms-excel"], {
    error: `File type must be one of: ${ACCEPTED_MIME_TYPES.join(", ")}`,
  }),
});

export type UploadMeta = z.infer<typeof uploadMetaSchema>;

// ─── Analyze request schema ───────────────────────────────────────────────────

/**
 * Zod schema for the POST /api/analyze request body.
 * Validated at the route handler entry point before any AI call.
 */
export const analyzeRequestSchema = z.object({
  /** Serialized GateRow — re-validated against csvRowSchema in the handler. */
  gateRow: z.record(z.string(), z.unknown()),
  /** The volunteer's question or selected quick action label. */
  question: z.string().min(1).max(500),
  /** SHA-256 hash of the full dataset — used for cache key construction. */
  datasetHash: z.string().min(1),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
