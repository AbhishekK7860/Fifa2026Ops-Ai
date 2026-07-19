/**
 * Input sanitizer — two concerns:
 *
 * 1. Control character stripping — applied to ALL string inputs before they
 *    reach the AI prompt (CSV field values AND the volunteer's question).
 *
 * 2. PII scrubbing — applied to the volunteer's question text (and logged
 *    as a security event when triggered) so PII never reaches the model or logs.
 *
 * Applied uniformly to every CSV-derived cell value AND to the question text,
 * per the security requirement that all data injected into the prompt receives
 * the same treatment.
 */

import type { SecurityEvent } from "@/types/analysis";
import type { GateRow } from "@/lib/schemas/csvRowSchema";

// ─── Control character stripping ──────────────────────────────────────────────

/**
 * Strips control characters from a string.
 *
 * Removed: U+0000–U+001F (C0 controls) EXCEPT \t (0x09) and \n (0x0A).
 * Also removes \r (0x0D) since CRLF normalization should have already occurred.
 * Removes U+007F (DEL) as well.
 *
 * Preserves printable ASCII, all Unicode above U+001F, \t, and \n.
 */
export function stripControlChars(input: string): string {
  // Matches: U+0000-U+0008, U+000B-U+000C, U+000D, U+000E-U+001F, U+007F
  return input.replace(/[\x00-\x08\x0B\x0C\x0D\x0E-\x1F\x7F]/g, "");
}

/**
 * Sanitizes all string fields of a GateRow for prompt injection defense.
 * Applies stripControlChars to every string-typed field.
 */
export function sanitizeGateRow(row: GateRow): GateRow {
  return {
    ...row,
    gate: stripControlChars(row.gate),
    status: row.status, // enum — no sanitization needed
    weather: stripControlChars(row.weather),
    timestamp: row.timestamp ? stripControlChars(row.timestamp) : undefined,
  };
}

// ─── PII scrubbing ─────────────────────────────────────────────────────────────

/**
 * SSN pattern: DDD-DD-DDDD (US Social Security Number).
 * Applied to question text only — never to CSV operational data.
 */
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

/**
 * Credit card pattern: 16 digits split into 4 groups by spaces or dashes.
 * Covers: DDDD DDDD DDDD DDDD, DDDD-DDDD-DDDD-DDDD, and run-together variants.
 */
const CREDIT_CARD_PATTERN = /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g;

/**
 * Phone number pattern: Supports US formats with optional country code, parens, dashes, dots.
 * Matches: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890
 */
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;

export type PiiCategory = "SSN" | "CREDIT_CARD" | "PHONE";

export interface PiiScrubResult {
  sanitized: string;
  redactedCategories: PiiCategory[];
}

/**
 * Scrubs SSNs and credit card numbers from the input string.
 * Replacements are opaque tokens — the actual values are never logged.
 *
 * @returns The sanitized string and a list of redacted PII categories.
 *          The list is used to build the SecurityEvent (count only, no content).
 */
export function scrubPii(input: string): PiiScrubResult {
  let sanitized = input;
  const redactedCategories: PiiCategory[] = [];

  const ssnMatches = sanitized.match(SSN_PATTERN);
  if (ssnMatches) {
    sanitized = sanitized.replace(SSN_PATTERN, "[REDACTED-SSN]");
    redactedCategories.push("SSN");
  }

  const ccMatches = sanitized.match(CREDIT_CARD_PATTERN);
  if (ccMatches) {
    sanitized = sanitized.replace(CREDIT_CARD_PATTERN, "[REDACTED-CC]");
    redactedCategories.push("CREDIT_CARD");
  }

  const phoneMatches = sanitized.match(PHONE_PATTERN);
  if (phoneMatches) {
    sanitized = sanitized.replace(PHONE_PATTERN, "[REDACTED-PHONE]");
    redactedCategories.push("PHONE");
  }

  return { sanitized, redactedCategories };
}

// ─── Security event factory ───────────────────────────────────────────────────

/**
 * Builds a PII_REDACTED SecurityEvent for server-side logging.
 * NEVER includes the offending text — only the count of matched patterns.
 */
export function buildPiiSecurityEvent(
  redactedCategories: PiiCategory[],
  ip: string
): SecurityEvent {
  return {
    type: "PII_REDACTED",
    timestamp: new Date().toISOString(),
    ip: hashIp(ip),
    matchCount: redactedCategories.length,
  };
}

/**
 * One-way truncation of IP for logging — not a cryptographic hash
 * (Web Crypto is async; this is sync). Sufficient for audit purposes.
 */
function hashIp(ip: string): string {
  // Keep only the first two octets of IPv4, or first segment of IPv6
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  // IPv6: keep first group only
  const v6parts = ip.split(":");
  return `${v6parts[0]}:xxxx:xxxx`;
}
