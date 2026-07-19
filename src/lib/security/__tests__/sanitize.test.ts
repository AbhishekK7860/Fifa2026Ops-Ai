import { describe, it, expect } from 'vitest';
import { stripControlChars, sanitizeGateRow, scrubPii, buildPiiSecurityEvent } from '../sanitize';
import type { GateRow } from '@/lib/schemas/csvRowSchema';

describe('Sanitize', () => {
  describe('stripControlChars', () => {
    it('strips control characters but preserves tabs and newlines', () => {
      const input = "Hello\x00World\nNew\tTab\x1FEnd\x7F";
      const expected = "HelloWorld\nNew\tTabEnd";
      expect(stripControlChars(input)).toBe(expected);
    });

    it('leaves clean input unchanged', () => {
      const clean = "Just a normal string with some spaces and numbers 123!";
      expect(stripControlChars(clean)).toBe(clean);
    });
  });

  describe('sanitizeGateRow', () => {
    it('sanitizes string fields of a GateRow', () => {
      const row: GateRow = {
        gate: "Gate\x00 A",
        capacity: 1000,
        currentVisitors: 500,
        queueLength: 50,
        volunteerCount: 10,
        status: "normal",
        transportDelay: 0,
        weather: "Clear\x01",
        medicalIncidents: 0,
        timestamp: "2026-07-19\x1FT00:00:00Z"
      };
      
      const sanitized = sanitizeGateRow(row);
      expect(sanitized.gate).toBe("Gate A");
      expect(sanitized.weather).toBe("Clear");
      expect(sanitized.timestamp).toBe("2026-07-19T00:00:00Z");
      // numeric fields untouched
      expect(sanitized.capacity).toBe(1000);
    });
  });

  describe('scrubPii', () => {
    it('removes SSN', () => {
      const input = "My SSN is 123-45-6789 please don't log it.";
      const { sanitized, redactedCategories } = scrubPii(input);
      expect(sanitized).toBe("My SSN is [REDACTED-SSN] please don't log it.");
      expect(redactedCategories).toContain("SSN");
    });

    it('removes Credit Card', () => {
      const input = "Use card 1234-5678-1234-5678 to pay.";
      const { sanitized, redactedCategories } = scrubPii(input);
      expect(sanitized).toBe("Use card [REDACTED-CC] to pay.");
      expect(redactedCategories).toContain("CREDIT_CARD");
    });

    it('removes Phone Number', () => {
      const input = "Call me at (555) 123-4567 or +1-800-555-1234.";
      const { sanitized, redactedCategories } = scrubPii(input);
      expect(sanitized).toContain("[REDACTED-PHONE]");
      expect(redactedCategories).toContain("PHONE");
    });

    it('leaves clean input unchanged', () => {
      const clean = "Just a question about Gate A.";
      const { sanitized, redactedCategories } = scrubPii(clean);
      expect(sanitized).toBe(clean);
      expect(redactedCategories).toHaveLength(0);
    });
  });

  describe('buildPiiSecurityEvent', () => {
    it('builds security event and masks IPv4', () => {
      const event = buildPiiSecurityEvent(["SSN"], "192.168.1.1");
      expect(event.type).toBe("PII_REDACTED");
      expect(event.matchCount).toBe(1);
      expect(event.ip).toBe("192.168.x.x");
    });

    it('masks IPv6', () => {
      const event = buildPiiSecurityEvent(["PHONE"], "2001:0db8:85a3:0000:0000:8a2e:0370:7334");
      expect(event.ip).toBe("2001:xxxx:xxxx");
    });
  });
});
