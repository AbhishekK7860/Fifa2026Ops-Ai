-- =============================================================================
-- Migration: 001_audit_log.sql
-- Table:     upload_audits
-- Purpose:   Anonymous dataset upload audit log — filename, row count,
--            session-scoped upload ID (SHA-256 prefix), and timestamp.
--            No PII, no user table, no auth dependency.
-- Scope:     Exactly as approved in the implementation plan (Phase 3 / Phase 8).
-- =============================================================================

-- Enable UUID generation (idempotent — safe to run on existing projects)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists upload_audits (
  -- Surrogate primary key (server-assigned, never from client)
  id          uuid        primary key default gen_random_uuid(),

  -- Mapped from UploadAuditLog.filename (string)
  -- The original filename from the uploaded CSV (e.g. "gates-2026-07-19.csv").
  -- Not a path; user-supplied name only, sanitised by the app before logging.
  filename    text        not null check (char_length(filename) <= 255),

  -- Mapped from UploadAuditLog.rowCount (number → integer)
  -- The count of valid data rows (excludes the header row).
  row_count   integer     not null check (row_count >= 0),

  -- Mapped from UploadAuditLog.timestamp (string ISO-8601)
  -- The server-side ISO-8601 timestamp of when the upload was processed.
  -- Stored as timestamptz for proper ordering; the app sends a UTC string.
  uploaded_at timestamptz not null,

  -- Mapped from UploadAuditLog.uploadId (string)
  -- First 16 hex characters of the SHA-256 hash of the CSV content.
  -- Used to correlate logs across requests without identifying users.
  -- No PII derivable from a hash prefix — the original file is never stored.
  upload_id   text        not null check (char_length(upload_id) = 16)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Efficiently query recent uploads (the primary operational use case)
create index if not exists upload_audits_uploaded_at_idx
  on upload_audits (uploaded_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- RLS is enabled. The only allowed operations are anonymous insert
-- (app writes) and anonymous select (diagnostic reads / dashboards).
-- No update or delete policies are created because:
--   (a) audit logs are append-only by design,
--   (b) no auth layer exists to gate row-level misuse of those operations.
alter table upload_audits enable row level security;

-- Allow the anonymous Supabase client (anon key) to insert new audit records.
-- The app uses the public anon key exclusively — no service-role key is used
-- in the upload path.
create policy "anon_insert"
  on upload_audits
  for insert
  to anon
  with check (true);

-- Allow the anonymous client to read audit records (e.g. for a future
-- diagnostic endpoint or operational dashboard).
create policy "anon_select"
  on upload_audits
  for select
  to anon
  using (true);

-- No UPDATE policy — audit rows are immutable.
-- No DELETE policy — audit rows are retained indefinitely (or pruned by
--   a future, separately approved migration).
