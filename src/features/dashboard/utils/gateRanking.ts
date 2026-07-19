/**
 * Gate Priority Ranking
 *
 * Produces a deterministic, code-defined ordering of gates by urgency.
 * The AI is NEVER responsible for gate ordering — this formula runs
 * independently and gates are always ranked before being passed to the model.
 *
 * Formula:
 *   score = (queueLength / max(volunteerCount, 1)) × QUEUE_VOLUNTEER_RATIO_WEIGHT
 *         + medicalIncidents × MEDICAL_INCIDENTS_WEIGHT
 *
 * Rationale:
 * - Queue-to-volunteer ratio captures "how overwhelmed is the staff" —
 *   a gate with 500 people queuing and 2 volunteers is more urgent than one
 *   with 500 people and 10 volunteers.
 * - Medical incidents are weighted separately as they represent immediate
 *   safety risk regardless of queue dynamics.
 *
 * All weight constants are named exports so tests can verify the formula
 * without coupling to magic numbers.
 */

import type { GateRow, RankedGate } from "@/types/csv";

// ─── Formula constants ────────────────────────────────────────────────────────

export const QUEUE_VOLUNTEER_RATIO_WEIGHT = 0.7;
export const MEDICAL_INCIDENTS_WEIGHT = 0.3;

// ─── Core scoring function ────────────────────────────────────────────────────

/**
 * Computes the priority score for a single gate.
 * Exported separately so unit tests can verify the formula in isolation.
 */
export function computePriorityScore(gate: GateRow): number {
  const queueVolunteerRatio =
    gate.queueLength / Math.max(gate.volunteerCount, 1);
  return (
    queueVolunteerRatio * QUEUE_VOLUNTEER_RATIO_WEIGHT +
    gate.medicalIncidents * MEDICAL_INCIDENTS_WEIGHT
  );
}

// ─── Ranking function ─────────────────────────────────────────────────────────

/**
 * Ranks all gates by priority score (descending).
 *
 * @param gates - Array of validated GateRow objects
 * @returns Array of RankedGate objects sorted highest-priority first (rank 1 = most urgent)
 */
export function rankGates(gates: GateRow[]): RankedGate[] {
  const scored = gates.map((gate) => ({
    gate,
    priorityScore: computePriorityScore(gate),
    rank: 0,
  }));

  // Sort descending by score; secondary sort by gate name for stable ordering on ties
  scored.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.gate.gate.localeCompare(b.gate.gate);
  });

  // Assign 1-based ranks
  return scored.map((item, index) => ({ ...item, rank: index + 1 }));
}

// ─── Convenience filters ──────────────────────────────────────────────────────

/**
 * Returns only gates with status "critical", sorted by rank (most urgent first).
 */
export function getCriticalGates(rankedGates: RankedGate[]): RankedGate[] {
  return rankedGates.filter((rg) => rg.gate.status === "critical");
}

/**
 * Returns the top N gates by priority, regardless of status.
 */
export function getTopNGates(rankedGates: RankedGate[], n: number): RankedGate[] {
  return rankedGates.slice(0, n);
}
