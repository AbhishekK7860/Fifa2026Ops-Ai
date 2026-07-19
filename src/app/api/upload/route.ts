import { NextRequest, NextResponse } from "next/server";
import { uploadMetaSchema } from "@/lib/schemas/uploadSchema";
import { validateMimeTypeServerSide } from "@/features/csv-upload/utils/mimeValidator";
import { validateUTF8, bufferToUTF8String, parseCSVContent } from "@/features/csv-upload/utils/csvParser";
import { validateCSV } from "@/features/csv-upload/utils/csvValidator";
import { hashDataset } from "@/lib/helpers/hashUtils";
import { checkRateLimit, retryAfterSeconds } from "@/lib/rateLimit";
import { logUploadAudit } from "@/lib/supabase/auditLog";
import { sanitizedErrorResponse } from "@/lib/helpers/errorSanitizer";

export const maxDuration = 30; // seconds

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    
    // ── 0. Rate Limiting ──────────────────────────────────────────────────────
    const uploadLimit = checkRateLimit("upload-burst", ip, 5, 60_000);
    
    const headers = {
      "X-RateLimit-Limit": "5",
      "X-RateLimit-Remaining": String(uploadLimit.remaining),
      "X-RateLimit-Reset": String(Math.ceil(uploadLimit.resetAt / 1000)),
    };

    if (!uploadLimit.allowed) {
      const retrySec = retryAfterSeconds(uploadLimit.retryAfterMs);
      return new NextResponse(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfterSeconds: retrySec,
        }),
        {
          status: 429,
          headers: {
            ...headers,
            "Retry-After": String(retrySec),
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ── 1. Pre-parse Size Limit ───────────────────────────────────────────────
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large. Maximum size is 2MB." }, { status: 413, headers });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No valid file uploaded." },
        { status: 400, headers }
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    // ── 2. Upload Metadata Validation ─────────────────────────────────────────
    const metaValidation = uploadMetaSchema.safeParse({
      filename: file.name,
      sizeBytes: buffer.byteLength,
      mimeType: file.type || "text/plain", // fallback if browser didn't set it
    });

    if (!metaValidation.success) {
      return NextResponse.json(
        { error: metaValidation.error.issues[0]?.message ?? "Invalid file metadata" },
        { status: 422, headers }
      );
    }

    // ── 3. Server-side MIME validation (Magic Bytes) ─────────────────────────
    const mimeResult = await validateMimeTypeServerSide(buffer);
    if (!mimeResult.valid) {
      return NextResponse.json(
        { error: mimeResult.message },
        { status: 415, headers } // Unsupported Media Type
      );
    }

    // ── 4. UTF-8 Validation ───────────────────────────────────────────────────
    const utf8Error = validateUTF8(buffer);
    if (utf8Error) {
      return NextResponse.json(
        {
          error: "Validation failed",
          validationResult: { valid: false, errors: [utf8Error], warnings: [], rows: [], rowCount: 0 }
        },
        { status: 422, headers }
      );
    }
    const csvContent = bufferToUTF8String(buffer);

    // ── 5. CSV Parsing ────────────────────────────────────────────────────────
    const parseResult = parseCSVContent(csvContent);
    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          validationResult: { valid: false, errors: parseResult.errors, warnings: [], rows: [], rowCount: 0 }
        },
        { status: 422, headers }
      );
    }

    // ── 6. Schema & Business Logic Validation ─────────────────────────────────
    const validationResult = validateCSV(parseResult.rawRows, parseResult.errors);

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: "Validation failed", validationResult },
        { status: 422, headers }
      );
    }

    // ── 7. Hash Dataset for Cache Keying ──────────────────────────────────────
    const datasetHash = await hashDataset(csvContent);

    // ── 8. Audit Log (Async, fire-and-forget) ─────────────────────────────────
    void logUploadAudit({
      filename: file.name,
      rowCount: validationResult.rows.length,
      timestamp: new Date().toISOString(),
      uploadId: datasetHash.substring(0, 16), // Use prefix of hash as upload ID
    });

    // ── 9. Success Response ───────────────────────────────────────────────────
    return NextResponse.json({
      validationResult,
      datasetHash,
      meta: {
        filename: file.name,
        rowCount: validationResult.rows.length,
        loadedAt: new Date().toISOString(),
        hasTimestamp: parseResult.hasTimestamp,
      }
    }, { headers });
  } catch (error) {
    return sanitizedErrorResponse(error, "An unexpected error occurred during upload processing.", 500);
  }
}
