import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as uploadPOST } from '@/app/api/upload/route';
import { checkRateLimit } from '@/lib/rateLimit';

// Mock validateMimeTypeServerSide and supabase to avoid actual side effects
vi.mock('@/features/csv-upload/utils/mimeValidator', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    validateMimeTypeServerSide: vi.fn(async (buffer: Uint8Array) => {
      const text = new TextDecoder().decode(buffer);
      if (text.includes('WRONG_MIME')) {
        return { valid: false, detectedMime: 'application/pdf', message: 'Wrong MIME' };
      }
      return { valid: true, detectedMime: 'text/csv' };
    }),
  };
});

vi.mock('@/lib/supabase/auditLog', () => ({ logUploadAudit: vi.fn() }));

describe('Upload Route Integration', () => {
  const validCsv = "Gate,Capacity,Current Visitors,Queue Length,Volunteer Count,Status,Transport Delay,Weather,Medical Incidents\nGate A,1000,500,50,10,normal,0,Clear,0";
  const missingColumnsCsv = "Capacity,Current Visitors\n1000,500";

  const createRequest = (content: string, ip: string = '127.0.0.1') => {
    const formData = new FormData();
    const file = new File([content], 'test.csv', { type: 'text/csv' });
    formData.append('file', file);

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip }
    });
    
    // Mocking FormData implementation
    Object.defineProperty(req, 'formData', {
      value: vi.fn().mockResolvedValue(formData),
      writable: true
    });
    
    return req;
  };

  it('valid file -> 200 OK', async () => {
    global.fetch = async () => new Response(JSON.stringify({ datasetHash: 'abc', summary: 'ok' }), { status: 200 });
    const req = createRequest(validCsv, '10.1.0.1');
    const res = await uploadPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.validationResult.valid).toBe(true);
    expect(body.datasetHash).toBeTruthy();
  });

  it('oversized payload -> 413 pre-parse', async () => {
    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      headers: { 'content-length': (2.1 * 1024 * 1024).toString() }
    });
    const res = await uploadPOST(req);
    expect(res.status).toBe(413);
  });

  it('wrong MIME -> 415', async () => {
    const req = createRequest('WRONG_MIME', '10.1.0.2');
    const res = await uploadPOST(req);
    expect(res.status).toBe(415);
  });

  it('missing columns -> 422 named', async () => {
    const req = createRequest(missingColumnsCsv, '10.1.0.3');
    const res = await uploadPOST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.validationResult.valid).toBe(false);
    expect(body.validationResult.errors[0].type).toBe('MISSING_COLUMNS');
    expect(body.validationResult.errors[0].message).toContain('Gate');
  });

  it('burst rate limit -> 429 (structured body + headers)', async () => {
    const ip = '10.1.0.4';
    // Exhaust limit (5)
    for (let i = 0; i < 5; i++) {
      checkRateLimit("upload-burst", ip, 5, 60000);
    }
    const req = createRequest(validCsv, ip);
    const res = await uploadPOST(req);
    expect(res.status).toBe(429);
    
    const body = await res.json();
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.retryAfterSeconds).toBeDefined();
    
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});
