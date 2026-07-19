import { describe, it, expect, vi } from 'vitest';
import { validateMimeTypeClientSide, validateMimeTypeServerSide } from '../utils/mimeValidator';

vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(async (buf: Uint8Array) => {
    if (buf.length === 0 || (buf[0] !== 0x25 && buf[0] !== 0x89)) return undefined; // mock text
    if (buf[0] === 0x25) return { mime: 'application/pdf', ext: 'pdf' };
    if (buf[0] === 0x89) return { mime: 'image/png', ext: 'png' };
    return undefined;
  })
}));

describe('MIME Validator - Client Side', () => {
  it('accepts valid CSV mime types', () => {
    const file = new File([''], 'test.csv', { type: 'text/csv' });
    const result = validateMimeTypeClientSide(file);
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe('text/csv');
  });

  it('rejects unaccepted MIME types like PDF', () => {
    const file = new File([''], 'test.pdf', { type: 'application/pdf' });
    const result = validateMimeTypeClientSide(file);
    expect(result.valid).toBe(false);
    expect(result.detectedMime).toBe('application/pdf');
    expect(result.message).toContain('not accepted');
  });

  it('allows empty MIME type to pass through for server-side check', () => {
    const file = new File([''], 'test.unknown', { type: '' });
    const result = validateMimeTypeClientSide(file);
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe('unknown');
  });
});

describe('MIME Validator - Server Side', () => {
  it('accepts text content (no magic bytes)', async () => {
    // Valid text has no magic bytes, file-type returns undefined
    const textBuffer = new TextEncoder().encode("Gate A,1000,500");
    const result = await validateMimeTypeServerSide(textBuffer);
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe('text/plain');
  });

  it('rejects arbitrary unknown binaries (e.g. PDF magic bytes)', async () => {
    // Fake PDF magic bytes (%PDF)
    const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
    const result = await validateMimeTypeServerSide(pdfBuffer);
    expect(result.valid).toBe(false);
    expect(result.detectedMime).toBe('application/pdf');
  });

  it('rejects extension spoofing (e.g. PNG masquerading as CSV)', async () => {
    // PNG magic bytes
    const pngBuffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const result = await validateMimeTypeServerSide(pngBuffer);
    expect(result.valid).toBe(false);
    expect(result.detectedMime).toBe('image/png');
  });
  it('falls back to accept if file-type inspection throws', async () => {
    const { fileTypeFromBuffer } = await import('file-type');
    vi.mocked(fileTypeFromBuffer).mockRejectedValueOnce(new Error('Inspection failed'));
    
    const buffer = new Uint8Array([0x01, 0x02]);
    const result = await validateMimeTypeServerSide(buffer);
    
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe('unknown');
  });
});
