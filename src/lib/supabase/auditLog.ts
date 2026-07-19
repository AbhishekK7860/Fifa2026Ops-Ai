/**
 * Supabase Audit Logger (Optional)
 *
 * Logs anonymous dataset upload metadata to Supabase.
 * No PII, no user authentication, no operational data is sent.
 *
 * Designed to fail open: if environment variables are missing or the network
 * request fails, it logs a warning and proceeds without breaking the upload flow.
 */

import { createClient } from "@supabase/supabase-js";
import type { SecurityEvent } from "@/types/analysis";

// Initialize client only if variables exist
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export interface UploadAuditLog {
  filename: string;
  rowCount: number;
  timestamp: string; // ISO string
  uploadId: string; // Used to correlate logs without identifying users
}

/**
 * Logs dataset upload metadata to Supabase.
 * Fails open (no-op) if Supabase is not configured or network fails.
 */
export async function logUploadAudit(log: UploadAuditLog): Promise<void> {
  if (!supabase) {
    console.log("[auditLog] Supabase not configured. Skipping upload audit.", log);
    return;
  }

  try {
    // Map camelCase TS fields → snake_case SQL columns (per migration 001_audit_log.sql)
    const { error } = await supabase.from("upload_audits").insert([{
      filename: log.filename,
      row_count: log.rowCount,
      uploaded_at: log.timestamp,
      upload_id: log.uploadId,
    }]);
    if (error) {
      console.warn("[auditLog] Failed to log upload:", error.message);
    }
  } catch (err) {
    console.warn("[auditLog] Exception during upload audit:", err);
  }
}

/**
 * Logs a security event to Supabase.
 * Fails open (no-op) if Supabase is not configured or network fails.
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  // Always log security events to the server console regardless of Supabase
  console.warn(`[SECURITY EVENT] ${event.type}: ${event.matchCount} match(es) from IP ${event.ip}`);

  if (!supabase) {
    return; // Already logged to console above
  }

  try {
    // Map camelCase TS fields → snake_case SQL columns (per migration 002_security_events.sql)
    const { error } = await supabase.from("security_events").insert([{
      type: event.type,
      occurred_at: event.timestamp,
      ip: event.ip,
      match_count: event.matchCount,
    }]);
    if (error) {
      console.warn("[auditLog] Failed to log security event:", error.message);
    }
  } catch (err) {
    console.warn("[auditLog] Exception during security event audit:", err);
  }
}
