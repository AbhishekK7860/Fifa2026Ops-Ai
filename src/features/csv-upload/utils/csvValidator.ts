/**
 * CSV Validator — converts raw parsed rows into typed, validated GateRow objects.
 *
 * Runs after csvParser.ts and before data enters the Zustand store.
 * Produces structured ValidationResult with field-specific, row-specific errors.
 */

import {
  csvRowSchema,
  QUEUE_LENGTH_OUTLIER_THRESHOLD,
  NUMERIC_FIELD_DISPLAY_NAMES,
  NUMERIC_FIELD_KEYS,
  type GateRow,
} from "@/lib/schemas/csvRowSchema";
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "@/types/csv";
import type { RawNormalizedRow } from "./csvParser";

// ─── Numeric coercion ─────────────────────────────────────────────────────────

/**
 * Attempts to parse a string value as a finite number.
 * Returns null if the value is missing, non-numeric, or not finite.
 */
function parseNumeric(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

// ─── Row coercion ─────────────────────────────────────────────────────────────

interface RowCoercionResult {
  coerced: Record<string, unknown>;
  coercionErrors: ValidationError[];
}

/**
 * Converts a raw string row into a typed object suitable for Zod validation.
 * Produces field-specific errors for any value that cannot be coerced.
 *
 * @param raw  - Normalized string row from csvParser
 * @param rowNumber - 1-indexed row number (not counting header), for error messages
 */
function coerceRow(raw: RawNormalizedRow, rowNumber: number): RowCoercionResult {
  const coercionErrors: ValidationError[] = [];
  const coerced: Record<string, unknown> = {};

  // String fields — copy as-is
  coerced.gate = raw.gate ?? "";
  coerced.weather = raw.weather ?? "";
  coerced.status = raw.status?.trim().toLowerCase() ?? "";
  if (raw.timestamp !== undefined) {
    coerced.timestamp = raw.timestamp;
  }

  // Numeric fields — parse and validate
  for (const key of NUMERIC_FIELD_KEYS) {
    const rawValue = raw[key];
    const parsed = parseNumeric(rawValue);
    if (parsed === null) {
      const displayName = NUMERIC_FIELD_DISPLAY_NAMES[key];
      coercionErrors.push({
        type: "INVALID_ROW_FORMAT",
        message: `Row ${rowNumber}: "${displayName}" must be a number, got: "${rawValue ?? "(empty)"}"`,
        row: rowNumber,
        column: displayName,
      });
      coerced[key] = NaN; // Zod will also flag this
    } else {
      coerced[key] = parsed;
    }
  }

  return { coerced, coercionErrors };
}

// ─── Outlier detection ────────────────────────────────────────────────────────

function checkOutliers(row: GateRow, rowNumber: number): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (row.queueLength > QUEUE_LENGTH_OUTLIER_THRESHOLD) {
    warnings.push({
      type: "QUEUE_OUTLIER",
      message: `Row ${rowNumber}: Queue Length (${row.queueLength.toLocaleString()}) exceeds the outlier threshold of ${QUEUE_LENGTH_OUTLIER_THRESHOLD.toLocaleString()}. This value has been flagged and will not be trusted at face value.`,
      row: rowNumber,
      column: "Queue Length",
    });
  }

  // Empty Weather reduces the confidence bound's completeness signal and is
  // surfaced as a warning so the AI receives an explicit signal about data gaps.
  if (!row.weather || row.weather.trim() === "") {
    warnings.push({
      type: "MISSING_OPTIONAL_FIELD",
      message: `Row ${rowNumber}: "Weather" is empty. Weather context is unavailable; confidence in weather-related analysis may be lower.`,
      row: rowNumber,
      column: "Weather",
    });
  }

  return warnings;
}

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Validates an array of raw normalized rows against the CSV schema.
 *
 * For each row:
 * 1. Coerce string values to typed values (numeric fields parsed with Number())
 * 2. Validate with Zod (status enum, non-negative numerics, required strings)
 * 3. Flag statistical outliers (queue length > QUEUE_LENGTH_OUTLIER_THRESHOLD)
 *
 * A single invalid row does not stop processing — all rows are validated and
 * all errors collected before returning.
 *
 * @param rawRows - Output from parseCSVContent()
 */
export function validateCSVRows(rawRows: RawNormalizedRow[]): {
  validRows: GateRow[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const validRows: GateRow[] = [];
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 1; // 1-indexed for human-facing messages

    // ── Coerce strings to typed values ────────────────────────────────────────
    const { coerced, coercionErrors } = coerceRow(raw, rowNumber);
    errors.push(...coercionErrors);

    if (coercionErrors.length > 0) {
      // Skip Zod validation for rows with coercion errors to avoid noise
      return;
    }

    // ── Zod validation ────────────────────────────────────────────────────────
    const result = csvRowSchema.safeParse(coerced);

    if (!result.success) {
      for (const issue of result.error.issues) {
        const fieldKey = issue.path[0]?.toString() ?? "unknown";
        const displayName =
          NUMERIC_FIELD_DISPLAY_NAMES[fieldKey] ??
          fieldKey.replace(/([A-Z])/g, " $1").trim();

        errors.push({
          type:
            fieldKey === "status" ? "INVALID_STATUS" : "INVALID_ROW_FORMAT",
          message: `Row ${rowNumber}: ${displayName} — ${issue.message}`,
          row: rowNumber,
          column: displayName,
        });
      }
      return;
    }

    // ── Outlier detection ──────────────────────────────────────────────────────
    const rowWarnings = checkOutliers(result.data, rowNumber);
    warnings.push(...rowWarnings);

    validRows.push(result.data);
  });

  return { validRows, errors, warnings };
}

// ─── Full pipeline ────────────────────────────────────────────────────────────

/**
 * Combines parseCSVContent + validateCSVRows into a single call.
 * Returns a complete ValidationResult.
 */
export function validateCSV(
  rawRows: RawNormalizedRow[],
  parseErrors: ValidationError[]
): ValidationResult {
  if (parseErrors.length > 0) {
    return {
      valid: false,
      errors: parseErrors,
      warnings: [],
      rows: [],
      rowCount: 0,
    };
  }

  const { validRows, errors, warnings } = validateCSVRows(rawRows);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rows: validRows,
    rowCount: rawRows.length,
  };
}

export type { ValidationResult };
