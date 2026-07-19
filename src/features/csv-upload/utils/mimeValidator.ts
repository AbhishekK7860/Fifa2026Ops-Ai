import {
  ACCEPTED_MIME_TYPES,
  type AcceptedMimeType,
} from "@/lib/schemas/uploadSchema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MimeValidationResult {
  valid: boolean;
  detectedMime: string;
  message?: string;
}



// ─── Client-side validation (UX feedback only) ────────────────────────────────

/**
 * Fast browser-side MIME check using the File.type property.
 * This is UX feedback only — the server-side check is the source of truth.
 *
 * Note: File.type is set by the OS/browser based on file extension and is
 * user-controllable. It MUST NOT be trusted for security decisions.
 */
export function validateMimeTypeClientSide(file: File): MimeValidationResult {
  const mimeType = file.type.toLowerCase();

  if (!mimeType) {
    // Unknown type — allow through; the server will decide
    return { valid: true, detectedMime: "unknown" };
  }

  const isAccepted = (ACCEPTED_MIME_TYPES as readonly string[]).includes(
    mimeType
  );

  if (!isAccepted) {
    return {
      valid: false,
      detectedMime: mimeType,
      message: `File type "${mimeType}" is not accepted. Please upload a CSV file (.csv).`,
    };
  }

  return { valid: true, detectedMime: mimeType as AcceptedMimeType };
}

// ─── Server-side validation (source of truth) ─────────────────────────────────

/**
 * Server-side MIME validation using magic byte inspection via the `file-type`
 * package. This is the authoritative check — it inspects the actual file bytes,
 * not the Content-Type header or file extension (both are user-controllable).
 *
 * Allowlist strategy:
 * 1. file-type returns undefined (text content — no magic bytes) → ACCEPT.
 *    CSV and plain-text files have no universal magic byte signature, so
 *    undefined is the expected and correct result for valid uploads.
 * 2. file-type detects a type in ACCEPTED_MIME_TYPES → ACCEPT.
 * 3. file-type detects ANY other type (PDF, ZIP, image, audio, video,
 *    unknown binary, etc.) → REJECT.
 *    This ensures arbitrary or unknown MIME types are rejected by default,
 *    not silently passed.
 *
 * Loaded via dynamic import because file-type v22 is ESM-only.
 * next.config.ts declares it in serverExternalPackages to prevent bundling.
 */
export async function validateMimeTypeServerSide(
  buffer: Uint8Array
): Promise<MimeValidationResult> {
  try {
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(buffer);

    // Case 1: No magic bytes detected — text/plain content, expected for CSV.
    if (!detected) {
      return { valid: true, detectedMime: "text/plain" };
    }

    // Case 2: Allowlist check — only accept explicitly listed MIME types.
    // Any type not in ACCEPTED_MIME_TYPES is rejected, including unknown types.
    const isAccepted = (ACCEPTED_MIME_TYPES as readonly string[]).includes(
      detected.mime
    );

    if (!isAccepted) {
      return {
        valid: false,
        detectedMime: detected.mime,
        message: `File appears to be a ${detected.ext.toUpperCase()} file (${detected.mime}). Only CSV and plain-text files are accepted.`,
      };
    }

    return { valid: true, detectedMime: detected.mime };
  } catch {
    // If file-type fails to load or inspect, fail open and log.
    // The CSV parser will catch any structural issues downstream.
    console.warn(
      "[mimeValidator] file-type inspection failed — falling back to accept"
    );
    return { valid: true, detectedMime: "unknown" };
  }
}
