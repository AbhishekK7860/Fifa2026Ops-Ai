/**
 * Confidence bound calculator.
 *
 * Produces a locally-computed confidence estimate that is passed to the AI
 * as a hint. The returned `value` (0–100) is embedded in the system prompt;
 * the AI's confidence.score must land within ±15 of it (enforced server-side
 * in responseParser.ts by clamping).
 *
 * Three signals, each 0.0–1.0:
 *
 * Signal 1 — Completeness (weight 0.45)
 *   Ratio of required fields that are present and non-empty.
 *   Gate H (empty Weather) scores 8/9 ≈ 0.89.
 *
 * Signal 2 — Signal agreement (weight 0.40)
 *   Three consistency checks on related fields:
 *   a. currentVisitors ≤ capacity
 *   b. Status consistent with occupancy ratio (>90% → not "normal"; <50% → not "critical")
 *   c. Queue length not flagged as a statistical outlier
 *   Each failed check subtracts 1/3 from the signal.
 *
 * Signal 3 — Recency (weight 0.15)
 *   Fixed at 1.0 for session-loaded snapshot data.
 *   Rationale: for a single-snapshot upload there is no "staleness" to measure
 *   within the session; recency degrades only if future streaming data is added.
 *   This is documented as a constant so future implementations can widen the
 *   type without breaking callers.
 *
 * Final: Math.round((c * 0.45 + a * 0.40 + r * 0.15) * 100)
 */

import { QUEUE_LENGTH_OUTLIER_THRESHOLD } from "@/lib/schemas/csvRowSchema";
import type { GateRow } from "@/lib/schemas/csvRowSchema";
import type { ConfidenceBound } from "@/types/analysis";

// ─── Weight constants ─────────────────────────────────────────────────────────

export const COMPLETENESS_WEIGHT = 0.45;
export const AGREEMENT_WEIGHT = 0.40;
export const RECENCY_WEIGHT = 0.15;

/** Required fields counted in the completeness signal (9 total). */
const REQUIRED_FIELDS: (keyof GateRow)[] = [
  "gate",
  "capacity",
  "currentVisitors",
  "queueLength",
  "volunteerCount",
  "status",
  "transportDelay",
  "weather",
  "medicalIncidents",
];

const TOTAL_AGREEMENT_CHECKS = 3;

// ─── Individual signal calculators ───────────────────────────────────────────

function computeCompleteness(row: GateRow): number {
  const presentCount = REQUIRED_FIELDS.filter((field) => {
    const val = row[field];
    return val !== undefined && val !== null && String(val).trim() !== "";
  }).length;
  return presentCount / REQUIRED_FIELDS.length;
}

function computeAgreement(row: GateRow): number {
  let failures = 0;

  // Check a: visitors must not exceed capacity
  if (row.currentVisitors > row.capacity) failures++;

  // Check b: status must be consistent with occupancy ratio
  const occupancy = row.capacity > 0 ? row.currentVisitors / row.capacity : 0;
  if (occupancy > 0.9 && row.status === "normal") failures++;
  if (occupancy < 0.5 && row.status === "critical") failures++;

  // Check c: queue length must not be a statistical outlier
  if (row.queueLength > QUEUE_LENGTH_OUTLIER_THRESHOLD) failures++;

  return Math.max(0, (TOTAL_AGREEMENT_CHECKS - failures) / TOTAL_AGREEMENT_CHECKS);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes the three-signal confidence bound for a single gate row.
 *
 * @param row - A fully validated GateRow
 * @returns ConfidenceBound with the final value (0–100) and per-signal breakdown
 */
export function computeConfidenceBound(row: GateRow): ConfidenceBound {
  const completenessSignal = computeCompleteness(row);
  const agreementSignal = computeAgreement(row);
  // Recency is fixed at 1.0 for session-loaded snapshot data — see module doc
  const recencySignal = 1.0 as const;

  const value = Math.round(
    (completenessSignal * COMPLETENESS_WEIGHT +
      agreementSignal * AGREEMENT_WEIGHT +
      recencySignal * RECENCY_WEIGHT) * 100
  );

  // Clamp to [0, 100] as a safety net (should always be in range given weights sum to 1)
  const clampedValue = Math.min(100, Math.max(0, value));

  return {
    value: clampedValue,
    completenessSignal,
    agreementSignal,
    recencySignal,
  };
}
