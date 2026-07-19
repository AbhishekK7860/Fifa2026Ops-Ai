import { describe, it, expect } from 'vitest';
import { buildPrompt, buildRetryPrompt } from '../services/promptBuilder';
import type { GateRow } from '@/lib/schemas/csvRowSchema';

describe('Prompt Builder', () => {
  const dummyRow: GateRow = {
    gate: 'Gate A', capacity: 1000, currentVisitors: 500, queueLength: 50,
    volunteerCount: 10, status: 'normal', transportDelay: 0, weather: 'Clear', medicalIncidents: 0,
    timestamp: '2026-07-19T00:00:00Z'
  };
  const dummyBound = { value: 75, completenessSignal: 1, agreementSignal: 1, recencySignal: 1.0 as const };

  it('builds initial prompt', () => {
    const prompt = buildPrompt(dummyRow, "test question", dummyBound);
    expect(prompt.systemPrompt).toContain('SCHEMA_START');
    expect(prompt.userPrompt).toContain('test question');
  });

  it('builds retry prompt', () => {
    const prompt = buildRetryPrompt(dummyRow, "test question", dummyBound);
    expect(prompt.systemPrompt).toContain('SCHEMA_START');
    expect(prompt.userPrompt).toContain('not valid JSON');
    expect(prompt.userPrompt).toContain('test question');
  });
});
