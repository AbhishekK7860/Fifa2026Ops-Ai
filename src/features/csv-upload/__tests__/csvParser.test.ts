import { describe, it, expect, vi } from 'vitest';
import Papa from 'papaparse';
import { validateUTF8, bufferToUTF8String, parseCSVContent } from '../utils/csvParser';
import { MAX_CSV_ROWS } from '@/lib/schemas/uploadSchema';

describe('CSV Parser - UTF-8 Validation', () => {
  it('accepts valid UTF-8 and valid UTF-8 with emojis', () => {
    const validStr = "Hello World";
    const validEmojiStr = "Hello 🌎";
    const enc = new TextEncoder();
    
    expect(validateUTF8(enc.encode(validStr))).toBeNull();
    expect(validateUTF8(enc.encode(validEmojiStr))).toBeNull();
  });

  it('rejects invalid byte 0xFF and unrecognized binary / invalid UTF-8 adversarial case', () => {
    // 0xFF is invalid UTF-8
    const invalidBuffer = new Uint8Array([0xFF, 0xFE, 0xFD]);
    const err = validateUTF8(invalidBuffer);
    
    expect(err).not.toBeNull();
    expect(err?.type).toBe("INVALID_ENCODING");
  });

  it('bufferToUTF8String converts correctly', () => {
    const validStr = "Gate A,100,50";
    const enc = new TextEncoder();
    expect(bufferToUTF8String(enc.encode(validStr))).toBe(validStr);
  });
});

describe('CSV Parser - parsing logic', () => {
  const validHeader = "Gate,Capacity,Current Visitors,Queue Length,Volunteer Count,Status,Transport Delay,Weather,Medical Incidents";

  it('rejects an empty file', () => {
    const result = parseCSVContent("");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("EMPTY_FILE");
    expect(result.rawRows).toHaveLength(0);
  });

  it('rejects missing 1 column', () => {
    // Missing 'Capacity'
    const header = "Gate,Current Visitors,Queue Length,Volunteer Count,Status,Transport Delay,Weather,Medical Incidents\nA,50,10,2,normal,0,Clear,0";
    const result = parseCSVContent(header);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("MISSING_COLUMNS");
    expect(result.errors[0].message).toContain("Capacity");
  });

  it('rejects missing 3 columns', () => {
    // Missing 'Gate', 'Status', 'Weather'
    const header = "Capacity,Current Visitors,Queue Length,Volunteer Count,Transport Delay,Medical Incidents\n1000,50,10,2,0,0";
    const result = parseCSVContent(header);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("MISSING_COLUMNS");
    expect(result.errors[0].message).toContain("Gate");
    expect(result.errors[0].message).toContain("Status");
    expect(result.errors[0].message).toContain("Weather");
  });

  it('handles malformed row gracefully (PapaParse skips or leaves empty fields)', () => {
    const csv = `${validHeader}\nGate A,1000,500,50,10,normal,0,Clear,0\nMalformedRowWithNoCommas`;
    const result = parseCSVContent(csv);
    // Malformed row will result in undefined for all the missing columns in PapaParse's output, 
    // which our normalizer turns into "". It shouldn't crash parseCSVContent.
    expect(result.errors).toHaveLength(0);
    expect(result.rawRows).toHaveLength(2);
    expect(result.rawRows[1].gate).toBe("MalformedRowWithNoCommas");
    expect(result.rawRows[1].capacity).toBeUndefined();
  });

  it('parses valid file', () => {
    const csv = `${validHeader},Timestamp\nGate A,1000,500,50,10,normal,0,Clear,0,2026-07-19T00:00:00Z`;
    const result = parseCSVContent(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rawRows).toHaveLength(1);
    expect(result.rawRows[0].gate).toBe("Gate A");
    expect(result.hasTimestamp).toBe(true);
  });

  it('rejects files with rows exceeding MAX_CSV_ROWS (e.g. 501 rows)', () => {
    // Generate 501 rows
    const rows = Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => `Gate ${i},1000,500,50,10,normal,0,Clear,0`);
    const csv = `${validHeader}\n${rows.join('\n')}`;
    const result = parseCSVContent(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("ROW_LIMIT_EXCEEDED");
    expect(result.rawRows).toHaveLength(0);
  });
  it('handles PapaParse parse error gracefully', () => {
    const spy = (vi.spyOn(Papa, 'parse') as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      errors: [{ message: 'Mock error', type: 'Mock', code: '1', row: 1 }],
      data: [],
      meta: { delimiter: ',', linebreak: '\n', aborted: false, truncated: false }
    }));

    const result = parseCSVContent("Gate,Capacity\nA,1000");
    spy.mockRestore();
    
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("PARSE_ERROR");
  });

  it('handles PapaParse parse error with no message', () => {
    const spy = (vi.spyOn(Papa, 'parse') as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      errors: [{ type: 'Mock', code: '1', row: 1, message: '' }],
      data: [],
      meta: { delimiter: ',', linebreak: '\n', aborted: false, truncated: false }
    }));

    const result = parseCSVContent("Gate,Capacity\nA,1000");
    spy.mockRestore();
    expect(result.errors[0].message).toContain("unknown error");
  });

  it('handles PapaParse returning no fields and null values in data', () => {
    const spy = (vi.spyOn(Papa, 'parse') as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      errors: [],
      data: [{ 'Gate': null, 'Capacity': 1000 }],
      meta: { delimiter: ',', linebreak: '\n', aborted: false, truncated: false }
    }));
    const result = parseCSVContent("Gate,Capacity\n,1000");
    spy.mockRestore();
    // Missing required columns error is expected since fields is undefined
    expect(result.errors[0].type).toBe("MISSING_COLUMNS");
  });
});
