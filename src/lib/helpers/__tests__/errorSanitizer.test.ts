import { describe, it, expect } from 'vitest';
import { sanitizedErrorResponse, sanitizeUnexpectedError, safeErrorBody } from '../errorSanitizer';

describe('Error Sanitizer', () => {
  it('does not leak raw error objects to the client (isolated)', async () => {
    const rawError = new Error("Database connection failed completely");
    const response = sanitizedErrorResponse(rawError, "A safe error message", 500);
    
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("A safe error message");
    expect(body.message).toBeUndefined();
    expect(body.stack).toBeUndefined();
  });

  it('sanitizeUnexpectedError returns generic message and logs error', () => {
    const rawError = new Error("Secret DB Error");
    const result = sanitizeUnexpectedError(rawError);
    expect(result).toBe("An unexpected error occurred. Please try again.");
  });

  it('safeErrorBody returns safe JSON payload and logs error', () => {
    const rawError = new Error("Another DB Error");
    const result = safeErrorBody(rawError, "Custom safe message");
    expect(result.error).toBe("Custom safe message");
  });
});
