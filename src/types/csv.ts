// ============================================================
// Shared CSV / Dataset Types
// ============================================================
// GateRow and GateStatus are Zod-inferred in csvRowSchema.ts and
// re-exported here as the canonical source for consumers that
// import from @/types rather than directly from lib/schemas.
// ============================================================

export type {
  GateRow,
  GateStatus,
} from "@/lib/schemas/csvRowSchema";

/**
 * The result of the full CSV validation pipeline.
 * Errors block acceptance; warnings are surfaced as UI flags.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  rows: import("@/lib/schemas/csvRowSchema").GateRow[];
  rowCount: number;
}

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  /** 1-indexed row number (not counting header). */
  row?: number;
  /** Exact column name as displayed in the CSV (original casing). */
  column?: string;
}

export interface ValidationWarning {
  type: ValidationWarningType;
  message: string;
  row?: number;
  column?: string;
}

export type ValidationErrorType =
  | "EMPTY_FILE"
  | "MISSING_COLUMNS"
  | "INVALID_STATUS"
  | "NEGATIVE_VALUE"
  | "INVALID_ROW_FORMAT"
  | "ROW_LIMIT_EXCEEDED"
  | "FILE_TOO_LARGE"
  | "INVALID_MIME_TYPE"
  | "INVALID_ENCODING"
  | "PARSE_ERROR";

export type ValidationWarningType = "QUEUE_OUTLIER" | "MISSING_OPTIONAL_FIELD";

/** Metadata about the loaded dataset (used for audit log + UI display). */
export interface DatasetMeta {
  filename: string;
  rowCount: number;
  /**
   * ISO timestamp of when the dataset was loaded into the current session.
   * Used as the "recency" signal for the confidence bound — see confidenceBound.ts.
   * For single-snapshot uploads recency is treated as constant/maximal (1.0).
   */
  loadedAt: string;
  hasTimestamp: boolean;
}

/** A gate with its computed priority score and 1-based rank. */
export interface RankedGate {
  gate: import("@/lib/schemas/csvRowSchema").GateRow;
  priorityScore: number;
  rank: number;
}
