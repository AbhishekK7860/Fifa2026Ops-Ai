import { GateRow } from "@/lib/schemas/csvRowSchema";
import { stripControlChars, scrubPii, sanitizeGateRow, buildPiiSecurityEvent } from "./sanitize";
import { detectInjection, buildInjectionSecurityEvent } from "./injectionDetector";
import { logSecurityEvent } from "@/lib/supabase/auditLog";

export interface SecurityCheckpointResult {
  sanitizedQuestion: string;
  sanitizedRow: GateRow;
  injectionDetected: boolean;
}

/**
 * Global Security Control Rule Checkpoint
 * 
 * Enforces the primary AI security boundary by:
 * 1. Scrubbing personal data (PII) from inputs so it never reaches the model or logs.
 * 2. Defending against prompt injection.
 * 3. Sanitizing structured data (control character stripping).
 * 
 * This must be invoked immediately before any data is sent to the LLM.
 */
export function runSecurityCheckpoint(
  rawQuestion: string, 
  rawGateRow: GateRow, 
  ip: string
): SecurityCheckpointResult {
  // 1. Strip control characters from the free-text question
  const controlStrippedQuestion = stripControlChars(rawQuestion);
  
  // 2. Scrub PII from the question (SSN, Credit Card, Phone)
  const piiResult = scrubPii(controlStrippedQuestion);
  const sanitizedQuestion = piiResult.sanitized;
  
  if (piiResult.redactedCategories.length > 0) {
    void logSecurityEvent(buildPiiSecurityEvent(piiResult.redactedCategories, ip));
  }

  // 3. Sanitize structured gate data (removes control chars from fields)
  const sanitizedRow = sanitizeGateRow(rawGateRow);

  // 4. Detect prompt injection in the sanitized question
  const injectionResult = detectInjection(sanitizedQuestion);
  if (injectionResult.detected) {
    void logSecurityEvent(buildInjectionSecurityEvent(injectionResult.matchCount, ip));
  }

  return {
    sanitizedQuestion,
    sanitizedRow,
    injectionDetected: injectionResult.detected
  };
}
