import { z } from "zod";

// ─── Status enum ─────────────────────────────────────────────────────────────

export const GATE_STATUS_ENUM = ["normal", "busy", "critical"] as const;
export type GateStatus = (typeof GATE_STATUS_ENUM)[number];

export const gateStatusSchema = z.enum(GATE_STATUS_ENUM);

// ─── Queue outlier threshold ─────────────────────────────────────────────────

/**
 * Queue lengths above this value are accepted but flagged as statistical
 * outliers in the UI. They are never trusted at face value by the AI.
 * Named constant so tests can reference it directly.
 */
export const QUEUE_LENGTH_OUTLIER_THRESHOLD = 100_000;

// ─── CSV row schema ───────────────────────────────────────────────────────────

/**
 * Zod schema for a single, fully-validated, camelCase-normalized CSV row.
 * Numeric fields are expected to have been converted from strings before
 * this schema is applied (see csvValidator.ts).
 *
 * This is the single source of truth for GateRow shape — the TypeScript type
 * below is inferred from it to prevent duplication.
 */
export const csvRowSchema = z.object({
  gate: z.string().min(1, "Gate name cannot be empty").max(100, "Gate name exceeds maximum length"),
  capacity: z.number().min(0, "Capacity must be non-negative"),
  currentVisitors: z.number().min(0, "Current Visitors must be non-negative"),
  queueLength: z.number().min(0, "Queue Length must be non-negative"),
  volunteerCount: z.number().min(0, "Volunteer Count must be non-negative"),
  status: gateStatusSchema,
  transportDelay: z.number().min(0, "Transport Delay must be non-negative"),
  weather: z.string().max(255, "Weather description exceeds maximum length"),
  medicalIncidents: z
    .number()
    .min(0, "Medical Incidents must be non-negative"),
  /**
   * Optional — present only when the source CSV includes a Timestamp column.
   * Used to conditionally render the time-series chart.
   */
  timestamp: z.string().max(100, "Timestamp exceeds maximum length").optional(),
});

export type GateRow = z.infer<typeof csvRowSchema>;

// ─── Numeric field names (for field-specific error messages) ──────────────────

/**
 * Canonical display names for numeric fields, used in per-field error messages.
 * Maps camelCase key → original CSV column name for human-readable errors.
 */
export const NUMERIC_FIELD_DISPLAY_NAMES: Record<string, string> = {
  capacity: "Capacity",
  currentVisitors: "Current Visitors",
  queueLength: "Queue Length",
  volunteerCount: "Volunteer Count",
  transportDelay: "Transport Delay",
  medicalIncidents: "Medical Incidents",
};

export const NUMERIC_FIELD_KEYS = Object.keys(
  NUMERIC_FIELD_DISPLAY_NAMES
) as (keyof typeof NUMERIC_FIELD_DISPLAY_NAMES)[];
