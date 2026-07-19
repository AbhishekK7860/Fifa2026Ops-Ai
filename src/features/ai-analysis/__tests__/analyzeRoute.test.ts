import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/analyze/route';
import { checkRateLimit } from '@/lib/rateLimit';

// Mock audit logs
vi.mock('@/lib/supabase/auditLog', () => ({
  logSecurityEvent: vi.fn(),
  logUploadAudit: vi.fn(),
}));

describe('Analyze Route Integration', () => {
  const dummyRow = {
    gate: 'Gate A',
    capacity: 5000,
    currentVisitors: 4850,
    queueLength: 480,
    volunteerCount: 3,
    status: 'critical' as const,
    transportDelay: 25,
    weather: 'Sunny',
    medicalIncidents: 3,
  };

  const createRequest = (body: unknown, ip: string = '127.0.0.1') => {
    return new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: JSON.stringify(body)
    });
  };

  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.OPENROUTER_API_KEY;
  });

  it('valid -> AI response validated', async () => {
    global.fetch = async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            observation: 'obs',
            reasoning: 'reas',
            recommendedAction: 'act',
            expectedImpact: 'imp',
            confidence: { score: 70, basis: 'basis' },
            multilingualAnnouncement: { en: 'en', es: 'es', fr: 'fr' },
            sourceDataRefs: ['ref']
          })
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const req = createRequest({ gateRow: dummyRow, question: 'test', datasetHash: 'hash-1' }, '10.2.0.1');
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe('ai');
    expect(data.result.observation).toBe('obs');
  });

  it('timeout -> fallback path (and fallback failure -> offline mode)', async () => {
    // Simulate both failing to force offline mode
    global.fetch = async () => { throw new Error('AbortError'); };
    const req = createRequest({ gateRow: dummyRow, question: 'test', datasetHash: 'hash-2' }, '10.2.0.2');
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe('offline');
  });

  it('invalid body -> 400', async () => {
    const req = createRequest({ badBody: true }, '10.2.0.3');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('burst limit -> 429', async () => {
    const ip = '10.2.0.4';
    // Exhaust burst limit (30)
    for (let i = 0; i < 30; i++) {
      checkRateLimit("analyze-burst", ip, 30, 60000);
    }
    const req = createRequest({ gateRow: dummyRow, question: 'test', datasetHash: 'hash-burst' }, ip);
    const res = await POST(req);
    expect(res.status).toBe(429);
    
    const data = await res.json();
    expect(data.error).toBe('Rate limit exceeded');
    expect(res.headers.get("X-RateLimit-Limit")).toBe("30");
  });

  it('daily quota -> 429 + reset after 24h (mocked time)', async () => {
    vi.useFakeTimers();
    const ip = '10.2.0.5';
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Exhaust daily limit (100)
    for (let i = 0; i < 100; i++) {
      checkRateLimit("analyze-daily", ip, 100, oneDayMs);
    }
    
    const req = createRequest({ gateRow: dummyRow, question: 'test', datasetHash: 'hash-daily' }, ip);
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('Rate limit exceeded');
    expect(res.headers.get("X-Daily-Quota-Remaining")).toBe("0");

    // Advance 24h + 1ms
    vi.advanceTimersByTime(oneDayMs + 1);
    
    // Should be allowed now (will hit fetch mock and return 200)
    global.fetch = async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            observation: 'obs', reasoning: 'reas', recommendedAction: 'act',
            expectedImpact: 'imp', confidence: { score: 70, basis: 'basis' },
            multilingualAnnouncement: { en: 'en', es: 'es', fr: 'fr' }, sourceDataRefs: ['ref']
          })
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const req2 = createRequest({ gateRow: dummyRow, question: 'test', datasetHash: 'hash-daily-reset' }, ip);
    const res2 = await POST(req2);
    expect(res2.status).toBe(200); // Successfully reset

    vi.useRealTimers();
  });
});
