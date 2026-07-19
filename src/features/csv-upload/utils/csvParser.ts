/**
 * CSV Parser — converts raw CSV text into normalized row objects.
 *
 * Lazy-loading note: this module is large enough (pulls in PapaParse) to
 * warrant dynamic importing at the call site in client components:
 *   const { parseCSVContent } = await import('@/features/csv-upload/utils/csvParser');
 * Server-side Route Handlers may import it statically since they are not
 * subject to the client bundle budget.
 */

import Papa from "papaparse";
import { MAX_CSV_ROWS } from "@/lib/schemas/uploadSchema";
import type { ValidationError } from "@/types/csv";

// ─── UTF-8 validation ─────────────────────────────────────────────────────────

/**
 * Validates that a buffer contains valid UTF-8 encoded text.
 *
 * Uses `TextDecoder` with `fatal: true` so any invalid byte sequence throws
 * rather than being silently replaced with the U+FFFD replacement character.
 *
 * Pipeline position: called AFTER MIME validation and BEFORE CSV parsing.
 * A buffer that passes MIME validation but fails UTF-8 validation is rejected
 * with an INVALID_ENCODING error; the CSV parser is never invoked.
 *
 * @returns ValidationError if invalid; null if the buffer is valid UTF-8
 */
export function validateUTF8(buffer: Uint8Array): ValidationError | null {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(buffer);
    return null; // valid
  } catch {
    return {
      type: "INVALID_ENCODING",
      message:
        "File must be UTF-8 encoded. Non-UTF-8 characters were detected. " +
        "Please re-save the file as UTF-8 and re-upload.",
    };
  }
}

/**
 * Converts a Uint8Array buffer to a UTF-8 string.
 * Only call this after validateUTF8 has confirmed the buffer is valid.
 */
export function bufferToUTF8String(buffer: Uint8Array): string {
  return new TextDecoder("utf-8").decode(buffer);
}


// ─── Column name normalization ────────────────────────────────────────────────

/**
 * Maps canonical lowercase CSV header → camelCase field name used in GateRow.
 * Extra whitespace is trimmed before the lookup.
 */
const COLUMN_NAME_MAP: Record<string, string> = {
  gate: "gate",
  capacity: "capacity",
  "current visitors": "currentVisitors",
  "queue length": "queueLength",
  "volunteer count": "volunteerCount",
  status: "status",
  "transport delay": "transportDelay",
  weather: "weather",
  "medical incidents": "medicalIncidents",
  timestamp: "timestamp", // optional
};

const REQUIRED_CANONICAL_COLUMNS = [
  "gate",
  "capacity",
  "current visitors",
  "queue length",
  "volunteer count",
  "status",
  "transport delay",
  "weather",
  "medical incidents",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw row after column normalization but before type coercion or Zod validation. */
export type RawNormalizedRow = Record<string, string>;

export interface CsvParseResult {
  /** Normalized, unnormalized rows (all values still strings). */
  rawRows: RawNormalizedRow[];
  /** camelCase field names present after normalization. */
  normalizedHeaders: string[];
  /** Whether the optional Timestamp column was detected. */
  hasTimestamp: boolean;
  /** Parse-level errors (missing columns, empty file, row limit). */
  errors: ValidationError[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parses raw UTF-8 CSV text into normalized row objects.
 *
 * Responsibilities:
 * - Detect empty files
 * - Normalize header names (case-insensitive, whitespace-trimmed)
 * - Detect missing required columns (reports exact column names)
 * - Enforce max row count (MAX_CSV_ROWS)
 * - Return raw string rows for downstream type coercion + Zod validation
 *
 * NOT responsible for: type coercion, value validation, outlier detection.
 * Those are handled in csvValidator.ts.
 */
export function parseCSVContent(content: string): CsvParseResult {
  const errors: ValidationError[] = [];

  // ── 1. Empty file detection ────────────────────────────────────────────────
  if (!content || content.trim().length === 0) {
    return {
      rawRows: [],
      normalizedHeaders: [],
      hasTimestamp: false,
      errors: [
        {
          type: "EMPTY_FILE",
          message:
            "The uploaded file is empty. Please upload a CSV file with at least one row of data.",
        },
      ],
    };
  }

  // ── 2. PapaParse ──────────────────────────────────────────────────────────
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    // dynamicTyping disabled — we handle numeric coercion explicitly in the
    // validator to produce field-specific, row-specific error messages.
    dynamicTyping: false,
    transformHeader: (header: string) => header.trim(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return {
      rawRows: [],
      normalizedHeaders: [],
      hasTimestamp: false,
      errors: [
        {
          type: "PARSE_ERROR",
          message: `CSV could not be parsed: ${parsed.errors[0]?.message || "unknown error"}.`,
        },
      ],
    };
  }

  // ── 3. Header normalization ────────────────────────────────────────────────
  const originalHeaders: string[] = parsed.meta.fields ?? [];
  const headerNormMap: Record<string, string> = {}; // original → camelCase

  for (const original of originalHeaders) {
    const canonical = original.trim().toLowerCase();
    const camel = COLUMN_NAME_MAP[canonical];
    if (camel) {
      headerNormMap[original] = camel;
    }
  }

  // ── 4. Missing required columns ────────────────────────────────────────────
  const presentCamelNames = new Set(Object.values(headerNormMap));
  const missingCanonical: string[] = [];

  for (const required of REQUIRED_CANONICAL_COLUMNS) {
    const camel = COLUMN_NAME_MAP[required];
    if (!presentCamelNames.has(camel)) {
      // Report the original CSV column name (title-case) the user would expect
      missingCanonical.push(
        required
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      );
    }
  }

  if (missingCanonical.length > 0) {
    return {
      rawRows: [],
      normalizedHeaders: [],
      hasTimestamp: false,
      errors: [
        {
          type: "MISSING_COLUMNS",
          message: `Missing required column${missingCanonical.length > 1 ? "s" : ""}: ${missingCanonical.join(", ")}.`,
        },
      ],
    };
  }

  const hasTimestamp = presentCamelNames.has("timestamp");
  const normalizedHeaders = Array.from(presentCamelNames);

  // ── 5. Row count limit ─────────────────────────────────────────────────────
  if (parsed.data.length > MAX_CSV_ROWS) {
    errors.push({
      type: "ROW_LIMIT_EXCEEDED",
      message: `CSV contains ${parsed.data.length} rows but the maximum is ${MAX_CSV_ROWS}. Please trim the file and re-upload.`,
    });
    // Return error without rows — reject the entire file
    return { rawRows: [], normalizedHeaders, hasTimestamp, errors };
  }

  // ── 6. Normalize row keys ──────────────────────────────────────────────────
  const rawRows: RawNormalizedRow[] = parsed.data.map((row) => {
    const normalized: RawNormalizedRow = {};
    for (const [original, value] of Object.entries(row)) {
      const camel = headerNormMap[original];
      if (camel) {
        normalized[camel] = typeof value === "string" ? value : String(value ?? "");
      }
    }
    return normalized;
  });

  return { rawRows, normalizedHeaders, hasTimestamp, errors };
}
