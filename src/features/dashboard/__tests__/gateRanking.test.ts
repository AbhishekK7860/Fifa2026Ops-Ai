import { describe, it, expect } from 'vitest';
import { 
  computePriorityScore, 
  rankGates, 
  getCriticalGates, 
  getTopNGates
} from '../utils/gateRanking';
import type { GateRow } from '@/types/csv';

describe('Gate Ranking Logic', () => {
  const baseGate: GateRow = {
    gate: 'Gate A',
    capacity: 1000,
    currentVisitors: 500,
    queueLength: 100,
    volunteerCount: 10,
    status: 'normal',
    transportDelay: 0,
    weather: 'Clear',
    medicalIncidents: 0,
    timestamp: '2026-07-19T00:00:00Z'
  };

  it('computes correct priority score', () => {
    // 100 queue / 10 vol = 10 ratio * 0.7 = 7
    // 0 medical * 0.3 = 0
    // total = 7
    const score = computePriorityScore(baseGate);
    expect(score).toBe(7);
  });

  it('guards against division by zero volunteer count', () => {
    const noVolGate = { ...baseGate, volunteerCount: 0 };
    // 100 queue / max(0, 1) = 100 ratio * 0.7 = 70
    const score = computePriorityScore(noVolGate);
    expect(score).toBe(70);
  });

  it('weights medical incidents correctly', () => {
    const medGate = { ...baseGate, medicalIncidents: 5 };
    // ratio = 7
    // 5 medical * 0.3 = 1.5
    // total = 8.5
    const score = computePriorityScore(medGate);
    expect(score).toBe(8.5);
  });

  it('ranks multiple gates and breaks ties by name', () => {
    const gateA = { ...baseGate, gate: 'Gate A', queueLength: 100, volunteerCount: 10 }; // Score 7
    const gateB = { ...baseGate, gate: 'Gate B', queueLength: 200, volunteerCount: 10 }; // Score 14
    const gateC = { ...baseGate, gate: 'Gate C', queueLength: 100, volunteerCount: 10 }; // Score 7 (tie with A)

    const ranked = rankGates([gateC, gateB, gateA]);
    
    expect(ranked[0].gate.gate).toBe('Gate B');
    expect(ranked[0].rank).toBe(1);
    
    expect(ranked[1].gate.gate).toBe('Gate A');
    expect(ranked[1].rank).toBe(2);
    
    expect(ranked[2].gate.gate).toBe('Gate C');
    expect(ranked[2].rank).toBe(3);
  });

  it('filters critical gates correctly', () => {
    const gateA = { ...baseGate, gate: 'Gate A', status: 'critical' as const };
    const gateB = { ...baseGate, gate: 'Gate B', status: 'normal' as const };
    const ranked = rankGates([gateB, gateA]);
    
    const critical = getCriticalGates(ranked);
    expect(critical).toHaveLength(1);
    expect(critical[0].gate.gate).toBe('Gate A');
  });

  it('returns top N gates correctly', () => {
    const gates = Array.from({ length: 5 }, (_, i) => ({
      ...baseGate,
      gate: `Gate ${i}`,
      queueLength: i * 100
    }));
    
    const ranked = rankGates(gates);
    const top2 = getTopNGates(ranked, 2);
    
    expect(top2).toHaveLength(2);
    expect(top2[0].gate.gate).toBe('Gate 4');
    expect(top2[1].gate.gate).toBe('Gate 3');
  });
});
