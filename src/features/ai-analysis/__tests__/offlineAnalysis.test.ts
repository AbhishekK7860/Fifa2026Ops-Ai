import { describe, it, expect } from 'vitest';
import { runOfflineAnalysis, buildOfflineResponse } from '../services/offlineAnalysis';
import type { GateRow } from '@/lib/schemas/csvRowSchema';

describe('Offline Analysis Fallback', () => {
  const dummyBound = { value: 85, completenessSignal: 1, agreementSignal: 1, recencySignal: 1.0 as const };
  const baseGate: GateRow = {
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

  it('produces normal template without nulls', () => {
    const result = runOfflineAnalysis(baseGate, "Test question", dummyBound);
    
    expect(result.observation).toContain("operating normally");
    expect(result.reasoning).toBeTruthy();
    expect(result.recommendedAction).toBeTruthy();
    expect(result.expectedImpact).toBeTruthy();
    expect(result.confidence.score).toBe(85);
    expect(result.multilingualAnnouncement.en).toBeTruthy();
    expect(result.multilingualAnnouncement.es).toBeTruthy();
    expect(result.multilingualAnnouncement.fr).toBeTruthy();
    expect(result.sourceDataRefs).toContain("Gate: Gate A");
    expect(result.sourceDataRefs).toContain("Question: Test question");
  });

  it('produces critical template properly with incidents and delay', () => {
    const criticalGate = { 
      ...baseGate, 
      status: 'critical' as const, 
      currentVisitors: 950,
      medicalIncidents: 2,
      transportDelay: 45
    };
    const result = runOfflineAnalysis(criticalGate, "", dummyBound);
    
    expect(result.observation).toContain("critical density");
    expect(result.reasoning).toContain("medical incidents reported");
    expect(result.reasoning).toContain("Transport delay");
    // ensure schema matches
    expect(result.recommendedAction).toContain("activate overflow protocol");
  });

  it('produces busy template properly with incidents', () => {
    const busyGate = { 
      ...baseGate, 
      status: 'busy' as const, 
      currentVisitors: 800,
      medicalIncidents: 1
    };
    const result = runOfflineAnalysis(busyGate, "", dummyBound);
    
    expect(result.observation).toContain("elevated occupancy");
    expect(result.reasoning).toContain("medical incident on record");
  });

  it('buildOfflineResponse wraps correctly', () => {
    const response = buildOfflineResponse(baseGate, "Hello", dummyBound);
    expect(response.mode).toBe('offline');
    expect(response.gateId).toBe('Gate A');
    expect(response.question).toBe('Hello');
    expect(response.result.confidence.score).toBe(85);
  });
  it('produces busy template properly without incidents', () => {
    const busyGateNoIncidents = { 
      ...baseGate, 
      status: 'busy' as const, 
      currentVisitors: 800,
      medicalIncidents: 0
    };
    const result = runOfflineAnalysis(busyGateNoIncidents, "", dummyBound);
    expect(result.observation).toContain("elevated occupancy");
    expect(result.reasoning).not.toContain("medical incident");
  });

  it('produces normal template properly with incidents', () => {
    const normalGateIncidents = { 
      ...baseGate, 
      status: 'normal' as const, 
      medicalIncidents: 1
    };
    const result = runOfflineAnalysis(normalGateIncidents, "", dummyBound);
    expect(result.observation).toContain("operating normally");
    expect(result.reasoning).toContain("medical incident(s) recorded");
  });

  it('handles critical template without incidents or delay', () => {
    const criticalGateClean = { 
      ...baseGate, 
      status: 'critical' as const, 
      currentVisitors: 950,
      medicalIncidents: 0,
      transportDelay: 0
    };
    const result = runOfflineAnalysis(criticalGateClean, "", dummyBound);
    expect(result.observation).toContain("critical density");
    expect(result.reasoning).not.toContain("medical incident");
    expect(result.reasoning).not.toContain("Transport delay");
  });
});
