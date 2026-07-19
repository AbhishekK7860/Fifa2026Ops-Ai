// ============================================================
// Shared AI Analysis Types
// ============================================================
// AIAnalysisResult is Zod-inferred in aiOutputSchema.ts and
// re-exported here as the canonical source for consumers.
// ============================================================

export type { AIAnalysisResult } from "@/lib/schemas/aiOutputSchema";

/**
 * Whether the analysis was produced by the live AI or deterministic
 * offline rules. Added server-side before the response is returned.
 */
export type AnalysisMode = "ai" | "offline";

/** Full analysis response including mode metadata. */
export interface AnalysisResponse {
  result: import("@/lib/schemas/aiOutputSchema").AIAnalysisResult;
  mode: AnalysisMode;
  /** ISO timestamp of when the analysis was generated server-side. */
  generatedAt: string;
  /** Gate name this analysis applies to. */
  gateId: string;
  /** The question / action label that triggered the analysis. */
  question: string;
}

/**
 * The locally computed confidence bound passed to the AI as a hint.
 * The returned confidence.score must be within ±15 of this value.
 */
export interface ConfidenceBound {
  /** Final bound (0–100). */
  value: number;
  /** Signal 1: fraction of required fields present and valid (0.0–1.0). */
  completenessSignal: number;
  /** Signal 2: data consistency across related fields (0.0–1.0). */
  agreementSignal: number;
  /**
   * Signal 3: recency (always 1.0 for session-loaded snapshot data).
   * Documented as a literal type so future streaming implementations
   * can widen it without breaking existing consumers.
   *
   * See confidenceBound.ts for full rationale.
   */
  recencySignal: 1.0;
}

/**
 * SHA-256 hash string used as a session-scoped AI response cache key.
 * Format: SHA-256(datasetHash + "|" + question)
 */
export type AnalysisCacheKey = string;

/** Security event logged when prompt injection or PII is detected in input. */
export interface SecurityEvent {
  type: "PROMPT_INJECTION" | "PII_REDACTED";
  timestamp: string;
  /** Hashed or truncated IP — never the raw IP in logs. */
  ip: string;
  /** Number of patterns matched. Never logs the offending text itself. */
  matchCount: number;
}
