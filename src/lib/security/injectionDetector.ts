/**
 * Prompt injection detector.
 *
 * Scans the volunteer's question text for patterns that attempt to override
 * the AI's system instructions. On detection:
 * - The LLM is NEVER invoked — the input is never forwarded to the model.
 * - A SecurityEvent is logged server-side (timestamp, IP, match count).
 * - The request is routed to Offline Analysis Mode.
 *
 * The offending text is NEVER logged, echoed, or stored anywhere.
 *
 * Scope: applied to the volunteer's free-text question only.
 * CSV field values receive control-char stripping (sanitize.ts) but not
 * injection detection, since they are wrapped in [DATA_START]/[DATA_END]
 * delimiters in the prompt and labelled as structured data.
 *
 * Note: This is a best-effort, heuristic protection mechanism based on regex
 * pattern matching. It is not an absolute prevention measure and can be
 * bypassed via obfuscation, encoding, or novel phrasing.
 */

import type { SecurityEvent } from "@/types/analysis";

// ─── Detection patterns ───────────────────────────────────────────────────────

/**
 * Regex patterns for common prompt injection techniques.
 * All patterns are case-insensitive and match partial words (word boundaries
 * are used where a false-positive risk exists).
 *
 * New patterns should be added here; the detector itself needs no changes.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:previous|all|above|prior)\s+instructions?/i,
  /disregard\s+(?:all|your|previous|the)\s+(?:rules?|instructions?|guidelines?|context)/i,
  /forget\s+(?:your|the|all|previous|prior)\s+(?:instructions?|rules?|context|training)/i,
  /you\s+are\s+now\s+(?:a|an|the)\s+/i,
  /pretend\s+(?:you\s+are|to\s+be|that\s+you)/i,
  /act\s+as\s+(?:if|though|a|an)\s+/i,
  /(?:new|updated|revised)\s+(?:system\s+)?(?:prompt|instructions?|directive)/i,
  /override\s+(?:your|all|previous|the)\s+(?:instructions?|rules?|directives?|constraints?)/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /\bdo\s+anything\s+now\b/i,
  /system\s*:\s*you\s+are/i, // attempts to inject a new SYSTEM role
  /\[SYSTEM\]/i,
  /\[INST\]/i, // Llama instruction injection
];

// ─── Detector ────────────────────────────────────────────────────────────────

export interface InjectionDetectionResult {
  detected: boolean;
  /** Number of pattern matches (never the matching text itself). */
  matchCount: number;
}

/**
 * Checks the input string for prompt injection patterns.
 * Returns the detection result — never the matched text.
 */
export function detectInjection(input: string): InjectionDetectionResult {
  let matchCount = 0;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      matchCount++;
    }
  }
  return { detected: matchCount > 0, matchCount };
}

// ─── Security event factory ───────────────────────────────────────────────────

/**
 * Builds a PROMPT_INJECTION SecurityEvent for server-side logging.
 * NEVER includes the offending text — only the count of matched patterns
 * and the (truncated) IP address.
 */
export function buildInjectionSecurityEvent(
  matchCount: number,
  ip: string
): SecurityEvent {
  return {
    type: "PROMPT_INJECTION",
    timestamp: new Date().toISOString(),
    ip: maskIp(ip),
    matchCount,
  };
}

/** Masks all but the first two octets of an IPv4 address for log safety. */
function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  const v6parts = ip.split(":");
  return `${v6parts[0]}:xxxx`;
}
