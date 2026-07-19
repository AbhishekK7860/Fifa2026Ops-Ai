import { describe, it, expect } from 'vitest';
import { parseAndValidateResponse, AIResponseParseError } from '../services/responseParser';

describe('Response Parser', () => {
  const dummyBound = { value: 70, completenessSignal: 1, agreementSignal: 1, recencySignal: 1.0 as const };
  const validJsonObj = {
    observation: "obs",
    reasoning: "reason",
    recommendedAction: "action",
    expectedImpact: "impact",
    confidence: { score: 75, basis: "basis" },
    multilingualAnnouncement: { en: "en", es: "es", fr: "fr" },
    sourceDataRefs: ["ref1"]
  };
  const validJsonStr = JSON.stringify(validJsonObj);

  it('parses valid JSON without fences', () => {
    const result = parseAndValidateResponse(validJsonStr, dummyBound);
    expect(result.observation).toBe("obs");
    expect(result.confidence.score).toBe(75);
  });

  it('strips markdown fences if present', () => {
    const fenced = `\`\`\`json\n${validJsonStr}\n\`\`\``;
    const result = parseAndValidateResponse(fenced, dummyBound);
    expect(result.observation).toBe("obs");
  });

  it('throws on empty response', () => {
    expect(() => parseAndValidateResponse("", dummyBound)).toThrow(AIResponseParseError);
    expect(() => parseAndValidateResponse("   ", dummyBound)).toThrow(/empty/);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseAndValidateResponse("{ bad json", dummyBound)).toThrow(AIResponseParseError);
  });

  it('throws on missing required fields', () => {
    const missingObj = { ...validJsonObj };
    delete (missingObj as Partial<typeof validJsonObj>).observation;
    try {
      parseAndValidateResponse(JSON.stringify(missingObj), dummyBound);
      expect.unreachable();
    } catch (e: unknown) {
      expect((e as AIResponseParseError).type).toBe('SCHEMA_MISMATCH');
    }
  });

  it('clamps confidence within bounds (+15 / -15)', () => {
    // Model says 95, bound is 70. Max allowed is 85.
    const tooHigh = { ...validJsonObj, confidence: { score: 95, basis: 'high' } };
    const resultHigh = parseAndValidateResponse(JSON.stringify(tooHigh), dummyBound);
    expect(resultHigh.confidence.score).toBe(85); // 70 + 15

    // Model says 40, bound is 70. Min allowed is 55.
    const tooLow = { ...validJsonObj, confidence: { score: 40, basis: 'low' } };
    const resultLow = parseAndValidateResponse(JSON.stringify(tooLow), dummyBound);
    expect(resultLow.confidence.score).toBe(55); // 70 - 15

    // Model says 75, bound is 70. Allowed.
    const ok = { ...validJsonObj, confidence: { score: 75, basis: 'ok' } };
    const resultOk = parseAndValidateResponse(JSON.stringify(ok), dummyBound);
    expect(resultOk.confidence.score).toBe(75);
  });

  it('strips extra fields', () => {
    const extraFields = { ...validJsonObj, extra: "should not be here" };
    const result = parseAndValidateResponse(JSON.stringify(extraFields), dummyBound);
    expect((result as Record<string, unknown>).extra).toBeUndefined();
  });
});
