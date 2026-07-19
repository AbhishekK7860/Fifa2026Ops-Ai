import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedAnalysis, setCachedAnalysis, getCacheSize, clearAnalysisCache } from '../services/analysisCache';
import type { AnalysisResponse } from '@/types/analysis';

describe('Analysis Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAnalysisCache();
  });

  it('caches and retrieves items', () => {
    const key = 'test-key-1';
    const result = { mode: 'ai', result: { observation: 'test' } } as unknown as AnalysisResponse;
    
    setCachedAnalysis(key, result);
    
    const cached = getCachedAnalysis(key);
    expect(cached).toEqual(result);
    expect(getCacheSize()).toBe(1);
  });

  it('expires items after TTL', () => {
    const key = 'test-key-2';
    setCachedAnalysis(key, {} as unknown as AnalysisResponse);
    
    // Advance time by 31 minutes
    vi.advanceTimersByTime(31 * 60 * 1000);
    
    const cached = getCachedAnalysis(key);
    expect(cached).toBeNull();
  });
});
