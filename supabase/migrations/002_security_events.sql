-- =============================================================================
-- Migration: 002_security_events.sql
-- Table:     security_events
-- Purpose:   Logs anonymised security events (prompt injection attempts,
--            PII detections) for incident review and abuse pattern analysis.
--            IPs are already hashed/truncated by the app before this insert —
--            the raw IP never reaches this table or the logs.
-- Scope:     Approved addition to the originally planned single-table schema.
--            See SecurityEvent type in src/types/analysis.ts.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists security_events (
  -- Surrogate primary key (server-assigned)
  id           uuid        primary key default gen_random_uuid(),

  -- Mapped from SecurityEvent.type ("PROMPT_INJECTION" | "PII_REDACTED")
  -- Constrained to the two values defined in types/analysis.ts.
  type         text        not null
                           check (type in ('PROMPT_INJECTION', 'PII_REDACTED')),

  -- Mapped from SecurityEvent.timestamp (string ISO-8601)
  -- Server-side timestamp of when the event was detected.
  occurred_at  timestamptz not null,

  -- Mapped from SecurityEvent.ip (string)
  -- Already hashed or truncated by the app (logSecurityEvent docs:
  -- "Hashed or truncated IP — never the raw IP in logs").
  -- The raw caller IP is never stored here.
  ip           text        not null check (char_length(ip) <= 128),

  -- Mapped from SecurityEvent.matchCount (number → integer)
  -- Number of patterns matched. The offending text itself is never logged.
  match_count  integer     not null check (match_count >= 1)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Primary operational query: recent events by time
create index if not exists security_events_occurred_at_idx
  on security_events (occurred_at desc);

-- Secondary: filter by event type for incident pattern analysis
create index if not exists security_events_type_idx
  on security_events (type);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- RLS is enabled. The anon key (used by the app) may INSERT only.
-- SELECT is restricted to service-role key holders (incident review) —
-- security event patterns must not be readable by the public anon key.
-- No UPDATE or DELETE policies: audit rows are append-only and immutable.
alter table security_events enable row level security;

-- Allow the anonymous Supabase client (anon key) to insert security events.
-- The app uses the anon key; no service-role key is passed to the client.
create policy "anon_insert"
  on security_events
  for insert
  to anon
  with check (true);

-- No anon SELECT policy — security_events rows are readable only by a
-- service-role key (used for operational incident review), not the public
-- anon key. This prevents abuse-pattern data from being exposed via the
-- same key the app uses for write access.

-- No UPDATE policy — security event rows are immutable.
-- No DELETE policy — security event rows are retained for audit continuity.
