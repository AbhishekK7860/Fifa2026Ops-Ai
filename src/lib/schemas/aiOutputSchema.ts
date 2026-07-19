import { z } from "zod";

// ─── AI output Zod schema ─────────────────────────────────────────────────────

/**
 * Runtime validator for all AI responses — applied before any result is
 * rendered to the client. Invalid responses are rejected, not displayed.
 *
 * This schema is also serialized to AI_OUTPUT_SCHEMA_VERBATIM below and
 * embedded verbatim in every system prompt so the model has minimal room
 * to drift from the expected shape.
 */
export const aiOutputSchema = z.object({
  observation: z.string().min(1),
  reasoning: z.string().min(1),
  recommendedAction: z.string().min(1),
  expectedImpact: z.string().min(1),
  confidence: z.object({
    /** 0–100. Clamped server-side to within ±15 of the local confidence bound. */
    score: z.number().min(0).max(100),
    basis: z.string().min(1),
  }),
  multilingualAnnouncement: z.object({
    en: z.string().min(1),
    es: z.string().min(1),
    fr: z.string().min(1),
  }),
  /**
   * Exact source data fields/values that produced this conclusion.
   * Traceability to source data is a primary requirement — never empty.
   */
  sourceDataRefs: z.array(z.string()).min(1),
});

/** TypeScript type derived from the Zod schema — single source of truth. */
export type AIAnalysisResult = z.infer<typeof aiOutputSchema>;

// ─── Verbatim schema string for system prompt injection ───────────────────────

/**
 * The exact schema definition embedded in every AI system prompt.
 * Keeping this verbatim (not generated from the Zod schema at runtime)
 * ensures the model sees a stable, human-readable contract.
 *
 * IMPORTANT: If the aiOutputSchema above changes, update this string too.
 */
export const AI_OUTPUT_SCHEMA_VERBATIM = `{
  "observation": "string — what is happening at this gate right now",
  "reasoning": "string — why this situation requires attention, citing specific data",
  "recommendedAction": "string — concrete action the volunteer should take",
  "expectedImpact": "string — what outcome the action is expected to produce",
  "confidence": {
    "score": "integer 0-100 — MUST be within ±15 of the confidence hint provided",
    "basis": "string — brief explanation of why this confidence level was assigned"
  },
  "multilingualAnnouncement": {
    "en": "string — public announcement in English",
    "es": "string — public announcement in Spanish",
    "fr": "string — public announcement in French"
  },
  "sourceDataRefs": [
    "string — list of exact field: value pairs from the gate data that drove this analysis"
  ]
}`;
