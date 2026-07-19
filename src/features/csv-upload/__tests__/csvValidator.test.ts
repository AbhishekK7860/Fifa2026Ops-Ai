import { describe, it, expect } from 'vitest';
import { validateCSVRows, validateCSV } from '../utils/csvValidator';
import type { RawNormalizedRow } from '../utils/csvParser';

describe('CSV Validator', () => {
  const createValidRawRow = (overrides?: Partial<RawNormalizedRow>): RawNormalizedRow => ({
    gate: 'Gate A',
    capacity: '1000',
    currentVisitors: '500',
    queueLength: '50',
    volunteerCount: '10',
    status: 'normal',
    transportDelay: '0',
    weather: 'Clear',
    medicalIncidents: '0',
    ...overrides
  });

  it('validates a correct row successfully', () => {
    const rawRows = [createValidRawRow()];
    const result = validateCSVRows(rawRows);
    
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].gate).toBe('Gate A');
    expect(result.validRows[0].capacity).toBe(1000);
  });

  it('rejects negative numeric values', () => {
    const rawRows = [createValidRawRow({ capacity: '-100' })];
    const result = validateCSVRows(rawRows);
    
    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('INVALID_ROW_FORMAT');
    expect(result.errors[0].message).toContain('Capacity');
  });

  it('rejects unparseable (NaN) numeric values', () => {
    const rawRows = [createValidRawRow({ currentVisitors: 'abc' })];
    const result = validateCSVRows(rawRows);
    
    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('INVALID_ROW_FORMAT');
    expect(result.errors[0].message).toContain('must be a number');
  });

  it('rejects invalid Status enum values', () => {
    const rawRows = [createValidRawRow({ status: 'unknown' })];
    const result = validateCSVRows(rawRows);
    
    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('INVALID_STATUS');
  });

  it('flags Queue > 100,000 as a warning, not an error', () => {
    const rawRows = [createValidRawRow({ queueLength: '150000' })];
    const result = validateCSVRows(rawRows);
    
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('QUEUE_OUTLIER');
    expect(result.validRows).toHaveLength(1);
  });

  it('flags empty Weather as a missing optional field warning', () => {
    const rawRows = [createValidRawRow({ weather: '' })];
    const result = validateCSVRows(rawRows);
    
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('MISSING_OPTIONAL_FIELD');
    expect(result.validRows).toHaveLength(1);
  });

  it('validateCSV passes through parse errors directly', () => {
    const result = validateCSV([], [{ type: 'EMPTY_FILE', message: 'Empty' }]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('EMPTY_FILE');
    expect(result.rows).toHaveLength(0);
  });
});
