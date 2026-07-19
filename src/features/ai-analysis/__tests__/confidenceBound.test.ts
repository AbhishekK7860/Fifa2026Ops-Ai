import { describe, it, expect } from 'vitest';
import { computeConfidenceBound } from '../services/confidenceBound';
import type { GateRow } from '@/lib/schemas/csvRowSchema';

describe('Confidence Bound', () => {
  const perfectRow: GateRow = {
    gate: 'Gate A',
    capacity: 1000,
    currentVisitors: 500,
    queueLength: 50,
    volunteerCount: 10,
    status: 'normal',
    transportDelay: 0,
    weather: 'Clear',
    medicalIncidents: 0,
    timestamp: '2026-07-19T00:00:00Z'
  };

  it('computes 100 confidence for perfect row', () => {
    const bound = computeConfidenceBound(perfectRow);
    expect(bound.value).toBe(100);
    expect(bound.completenessSignal).toBe(1);
    expect(bound.agreementSignal).toBe(1);
    expect(bound.recencySignal).toBe(1);
  });

  it('reduces completeness signal for missing optional fields (e.g. empty weather)', () => {
    const row = { ...perfectRow, weather: '' };
    const bound = computeConfidenceBound(row);
    // 8 out of 9 fields present = 0.888
    expect(bound.completenessSignal).toBeCloseTo(8 / 9, 2);
    // Value = (8/9 * 0.45 + 1.0 * 0.40 + 1.0 * 0.15) * 100
    // = (0.4 + 0.4 + 0.15) * 100 = 95
    expect(bound.value).toBe(95);
  });

  it('reduces agreement signal if currentVisitors > capacity', () => {
    const row = { ...perfectRow, currentVisitors: 2000, status: 'critical' as const };
    const bound = computeConfidenceBound(row);
    // Fails check a, passes b (critical), passes c. 2/3 agreement = 0.666
    expect(bound.agreementSignal).toBeCloseTo(2 / 3, 2);
  });

  it('reduces agreement signal if occupancy > 90% but status is normal', () => {
    const row = { ...perfectRow, currentVisitors: 950, status: 'normal' as const };
    const bound = computeConfidenceBound(row);
    // Fails check b. 2/3 agreement = 0.666
    expect(bound.agreementSignal).toBeCloseTo(2 / 3, 2);
  });

  it('reduces agreement signal if occupancy < 50% but status is critical', () => {
    const row = { ...perfectRow, currentVisitors: 100, status: 'critical' as const };
    const bound = computeConfidenceBound(row);
    // Fails check b. 2/3 agreement = 0.666
    expect(bound.agreementSignal).toBeCloseTo(2 / 3, 2);
  });

  it('reduces agreement signal if queue > outlier threshold', () => {
    const row = { ...perfectRow, queueLength: 150000 };
    const bound = computeConfidenceBound(row);
    // Fails check c. 2/3 agreement = 0.666
    expect(bound.agreementSignal).toBeCloseTo(2 / 3, 2);
  });

  it('clamps value to bounds (0-100)', () => {
    // If we deliberately pass something that might drop below 0 (impossible with these formulas but good to test)
    // The clamp handles it. 
    const bound = computeConfidenceBound({} as unknown as GateRow);
    expect(bound.value).toBeGreaterThanOrEqual(0);
    expect(bound.value).toBeLessThanOrEqual(100);
  });
});
