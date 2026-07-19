/**
 * AI Response Parser — handles parsing, schema validation, and confidence clamping.
 *
 * This layer enforces the final contract on the LLM's raw text output:
 * 1. Strips markdown fences if the model leaked them (despite instructions).
 * 2. Parses JSON.
 * 3. Validates against aiOutputSchema (Zod).
 * 4. Clamps the confidence.score to within ±15 of the local bound.
 */

import { aiOutputSchema } from "@/lib/schemas/aiOutputSchema";
import type { AIAnalysisResult } from "@/lib/schemas/aiOutputSchema";
import type { ConfidenceBound } from "@/types/analysis";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CONFIDENCE_DEVIATION = 15;

// ─── Error types ──────────────────────────────────────────────────────────────

export type ParseErrorType = "INVALID_JSON" | "SCHEMA_MISMATCH";

export class AIResponseParseError extends Error {
  public type: ParseErrorType;
  public details?: unknown;

  constructor(type: ParseErrorType, message: string, details?: unknown) {
    super(message);
    this.name = "AIResponseParseError";
    this.type = type;
    this.details = details;
  }
}

// ─── Cleaners ─────────────────────────────────────────────────────────────────

/**
 * Strips markdown code fences (e.g. ```json ... ```) from raw AI output.
 * Models frequently inject these even when told not to.
 */
function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  // Strip opening fence (and optional language tag like `json`)
  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline !== -1) {
      cleaned = cleaned.substring(firstNewline + 1);
    } else {
      cleaned = cleaned.replace(/^```[a-z]*\s*/i, "");
    }
  }
  // Strip closing fence
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

/**
 * Clamps the model's confidence score to be within ±15 of the local bound.
 * Also enforces the global 0–100 range.
 */
function clampConfidence(
  modelScore: number,
  localBound: ConfidenceBound
): number {
  const minAllowed = Math.max(0, localBound.value - MAX_CONFIDENCE_DEVIATION);
  const maxAllowed = Math.min(100, localBound.value + MAX_CONFIDENCE_DEVIATION);

  if (modelScore < minAllowed) return minAllowed;
  if (modelScore > maxAllowed) return maxAllowed;
  return modelScore;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parses, validates, and clamps the raw AI response text.
 * Throws AIResponseParseError on failure.
 *
 * @param rawText - The raw string output from the LLM
 * @param localBound - The locally computed confidence bound
 * @returns Validated AIAnalysisResult with clamped confidence
 */
export function parseAndValidateResponse(
  rawText: string,
  localBound: ConfidenceBound
): AIAnalysisResult {
  if (!rawText || rawText.trim() === "") {
    throw new AIResponseParseError("INVALID_JSON", "AI response was empty.");
  }

  const cleanedText = stripMarkdownFences(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (err) {
    throw new AIResponseParseError(
      "INVALID_JSON",
      "AI response was not valid JSON.",
      { rawText: cleanedText, parseError: err }
    );
  }

  const validation = aiOutputSchema.safeParse(parsed);

  if (!validation.success) {
    throw new AIResponseParseError(
      "SCHEMA_MISMATCH",
      "AI response JSON did not match the expected schema.",
      { issues: validation.error.issues }
    );
  }

  const validResult = validation.data;

  // Clamp the confidence score to the allowed deviation range
  validResult.confidence.score = clampConfidence(
    validResult.confidence.score,
    localBound
  );

  return validResult;
}
