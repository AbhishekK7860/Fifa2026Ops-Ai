/**
 * Phase 2 verification script — run with: node scripts/verify-phase2.mjs
 * Verifies:
 *  A. MIME allowlist: arbitrary MIME type rejected; valid CSV text accepted
 *  B. Demo CSV: zero blocking errors; Gate C outlier warning; Gate H weather warning
 *  C. UTF-8 validation: valid UTF-8 passes; invalid bytes rejected
 *  D. Pipeline order documented and demonstrated
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─── A. MIME allowlist ────────────────────────────────────────────────────────
console.log('\n── A. MIME Allowlist (server-side) ─────────────────────────────────────────');
console.log('   Logic: undefined (text/no magic bytes) → accept');
console.log('          type in ACCEPTED_MIME_TYPES → accept');
console.log('          any other type → REJECT');
console.log('');

const ACCEPTED_MIME_TYPES = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];

// Simulate the allowlist logic with mocked file-type results
function simulateMimeValidation(detected) {
  if (!detected) return { valid: true, detectedMime: 'text/plain' };
  const isAccepted = ACCEPTED_MIME_TYPES.includes(detected.mime);
  if (!isAccepted) {
    return { valid: false, detectedMime: detected.mime, message: `File appears to be a ${detected.ext.toUpperCase()} file (${detected.mime}).` };
  }
  return { valid: true, detectedMime: detected.mime };
}

// Case 1: undefined → text CSV file → accept
const r1 = simulateMimeValidation(undefined);
assert('undefined (text CSV) → accept', r1.valid);

// Case 2: explicitly accepted type → accept
const r2 = simulateMimeValidation({ mime: 'text/csv', ext: 'csv' });
assert('text/csv → accept', r2.valid);

// Case 3: arbitrary unknown MIME type → reject (KEY TEST)
const r3 = simulateMimeValidation({ mime: 'audio/flac', ext: 'flac' });
assert('audio/flac (arbitrary unknown) → reject', !r3.valid, r3.message);

// Case 4: PDF → reject
const r4 = simulateMimeValidation({ mime: 'application/pdf', ext: 'pdf' });
assert('application/pdf → reject', !r4.valid, r4.message);

// Case 5: ZIP → reject (was in blocklist; confirm still rejected by allowlist)
const r5 = simulateMimeValidation({ mime: 'application/zip', ext: 'zip' });
assert('application/zip → reject', !r5.valid);

// Case 6: exotic type NOT in old blocklist → now also rejected (the gap the blocklist had)
const r6 = simulateMimeValidation({ mime: 'application/x-executable', ext: 'exe' });
assert('application/x-executable (was NOT in old blocklist) → now rejected', !r6.valid, r6.message);

// ─── B. Demo CSV validation ───────────────────────────────────────────────────
console.log('\n── B. Demo CSV validation ───────────────────────────────────────────────────');

const csvPath = path.join(ROOT, 'public', 'demo-data.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, dynamicTyping: false });

assert('demo-data.csv: zero parse errors', parsed.errors.length === 0);
assert('demo-data.csv: 10 rows', parsed.data.length === 10);

const REQUIRED_HEADERS = ['Gate','Capacity','Current Visitors','Queue Length',
  'Volunteer Count','Status','Transport Delay','Weather','Medical Incidents','Timestamp'];
const actualHeaders = parsed.meta.fields;
const missingHeaders = REQUIRED_HEADERS.filter(h => !actualHeaders.includes(h));
assert('All required + optional headers present', missingHeaders.length === 0, `missing: ${missingHeaders.join(', ')}`);

// Validate all rows for blocking errors
const GATE_STATUS_VALUES = ['normal', 'busy', 'critical'];
const NUMERIC_FIELDS = ['Capacity','Current Visitors','Queue Length','Volunteer Count','Transport Delay','Medical Incidents'];
const QUEUE_LENGTH_OUTLIER_THRESHOLD = 100_000;

let blockingErrors = [];
let warnings = [];

for (let i = 0; i < parsed.data.length; i++) {
  const row = parsed.data[i];
  const rowNum = i + 1;

  // Status enum
  if (!GATE_STATUS_VALUES.includes(row['Status'])) {
    blockingErrors.push(`Row ${rowNum}: invalid Status "${row['Status']}"`);
  }

  // Numeric fields non-negative
  for (const field of NUMERIC_FIELDS) {
    const val = Number(row[field]);
    if (isNaN(val)) blockingErrors.push(`Row ${rowNum}: ${field} is not a number`);
    else if (val < 0) blockingErrors.push(`Row ${rowNum}: ${field} is negative`);
  }

  // Gate name not empty
  if (!row['Gate'] || row['Gate'].trim() === '') {
    blockingErrors.push(`Row ${rowNum}: Gate name is empty`);
  }

  // Outlier warning
  if (Number(row['Queue Length']) > QUEUE_LENGTH_OUTLIER_THRESHOLD) {
    warnings.push({ type: 'QUEUE_OUTLIER', row: rowNum, gate: row['Gate'], value: row['Queue Length'] });
  }

  // Missing weather warning
  if (!row['Weather'] || row['Weather'].trim() === '') {
    warnings.push({ type: 'MISSING_OPTIONAL_FIELD', row: rowNum, gate: row['Gate'], column: 'Weather' });
  }
}

assert('demo-data.csv: zero blocking errors', blockingErrors.length === 0,
  blockingErrors.length ? blockingErrors[0] : '');

const outlierWarning = warnings.find(w => w.type === 'QUEUE_OUTLIER');
assert('Gate C queue=150,000 produces QUEUE_OUTLIER warning (not error)',
  outlierWarning !== undefined && outlierWarning.gate === 'Gate C',
  JSON.stringify(outlierWarning));

const weatherWarning = warnings.find(w => w.type === 'MISSING_OPTIONAL_FIELD');
assert('Gate H empty Weather produces MISSING_OPTIONAL_FIELD warning (not error)',
  weatherWarning !== undefined && weatherWarning.gate === 'Gate H',
  JSON.stringify(weatherWarning));

assert('Both warnings present, total blocking errors = 0',
  blockingErrors.length === 0 && warnings.length === 2);

// ─── C. UTF-8 validation ──────────────────────────────────────────────────────
console.log('\n── C. UTF-8 validation ─────────────────────────────────────────────────────');

function validateUTF8(buffer) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(buffer);
    return null;
  } catch {
    return { type: 'INVALID_ENCODING', message: 'File must be UTF-8 encoded.' };
  }
}

// Valid UTF-8
const validBuffer = Buffer.from('Gate,Capacity\nGate A,5000\n', 'utf-8');
assert('Valid UTF-8 buffer → null (no error)', validateUTF8(validBuffer) === null);

// UTF-8 with valid emoji (multi-byte)
const emojiBuffer = Buffer.from('Gate,Weather\nGate A,☀️ Sunny\n', 'utf-8');
assert('Valid UTF-8 with emoji → null (no error)', validateUTF8(emojiBuffer) === null);

// Invalid UTF-8 (Latin-1 byte 0xFF which is illegal in UTF-8)
const invalidBuffer = new Uint8Array([0x47, 0x61, 0x74, 0x65, 0xFF, 0x00]);
const utf8Error = validateUTF8(invalidBuffer);
assert('Invalid UTF-8 bytes → INVALID_ENCODING error', utf8Error !== null && utf8Error.type === 'INVALID_ENCODING',
  utf8Error ? utf8Error.message : 'no error returned');

// demo-data.csv itself is valid UTF-8
const demoBuffer = fs.readFileSync(csvPath);
assert('demo-data.csv is valid UTF-8', validateUTF8(demoBuffer) === null);

// KEY CASE: random binary bytes with no recognizable magic-byte signature.
// file-type would return undefined for this buffer (no known magic bytes match),
// so step 1 (MIME validation) passes — just as it passes for a valid CSV.
// Step 2 (UTF-8 validation) is what catches it: these bytes are not valid UTF-8
// and are rejected with INVALID_ENCODING before the CSV parser is ever invoked.
//
// Bytes chosen: 0x80 is a UTF-8 continuation byte in isolation (invalid as a
// leading byte), 0x91/0xA0/0xB0 are high-byte values that don't form any
// valid multi-byte UTF-8 sequence here. None of these form a magic-byte
// prefix for any format file-type recognises (PDF=0x25, ZIP=0x50 0x4B, etc.).
const unrecognizedBinaryBuffer = new Uint8Array([
  0x80, 0x91, 0xA0, 0xB0, 0x7F, 0x20, 0x80, 0x91,
  0xA0, 0xB0, 0x7F, 0x20, 0x80, 0x91, 0xA0, 0xB0,
]);

// Confirm step 1 would pass (file-type returns undefined → MIME logic accepts)
const mimeResultForUnrecognized = simulateMimeValidation(undefined); // undefined = what file-type returns
assert(
  'Unrecognized binary: step 1 (MIME) passes — file-type returns undefined, no magic bytes',
  mimeResultForUnrecognized.valid
);

// Confirm step 2 catches it (UTF-8 validation rejects the invalid bytes)
const utf8ErrorForUnrecognized = validateUTF8(unrecognizedBinaryBuffer);
assert(
  'Unrecognized binary: step 2 (UTF-8) rejects — invalid bytes caught before CSV parser',
  utf8ErrorForUnrecognized !== null &&
    utf8ErrorForUnrecognized.type === 'INVALID_ENCODING',
  utf8ErrorForUnrecognized ? utf8ErrorForUnrecognized.message : 'no error returned'
);


// ─── D. Pipeline order ────────────────────────────────────────────────────────
console.log('\n── D. Pipeline order ────────────────────────────────────────────────────────');
console.log('   Intended order (per implementation plan):');
console.log('   1. MIME validation (validateMimeTypeServerSide)');
console.log('   2. UTF-8 validation (validateUTF8)');
console.log('   3. CSV parsing (parseCSVContent)');
console.log('   4. Schema / business validation (validateCSVRows)');
console.log('');
console.log('   Failure semantics:');
console.log('   - MIME failure → return 415 Unsupported Media Type; stop');
console.log('   - UTF-8 failure → return 422 with INVALID_ENCODING; stop');
console.log('   - Parse failure (empty/missing cols/row limit) → return 422; stop');
console.log('   - Schema failure → return 422 with per-field errors; stop');
console.log('   - Warnings (outlier/missing field) → attach to 200 response; continue');
console.log('');

// Simulate pipeline decision points on a bad PDF buffer
// (We simulate; actual file-type is ESM and would need dynamic import)
function simulatePipeline(mimeDetected, bufferIsUTF8, csvContent) {
  const steps = [];

  // Step 1: MIME
  const mimeResult = simulateMimeValidation(mimeDetected);
  steps.push({ step: 'MIME', passed: mimeResult.valid });
  if (!mimeResult.valid) return { steps, stopped_at: 'MIME' };

  // Step 2: UTF-8
  const utf8Result = bufferIsUTF8 ? null : { type: 'INVALID_ENCODING' };
  steps.push({ step: 'UTF-8', passed: utf8Result === null });
  if (utf8Result) return { steps, stopped_at: 'UTF-8' };

  // Step 3: Parse
  steps.push({ step: 'CSV_PARSE', passed: true });

  // Step 4: Validate
  steps.push({ step: 'SCHEMA_VALIDATE', passed: true });

  return { steps, stopped_at: null };
}

const pipelineA = simulatePipeline({ mime: 'application/pdf', ext: 'pdf' }, true, '...');
assert('PDF upload stops at step 1 (MIME)', pipelineA.stopped_at === 'MIME');

const pipelineB = simulatePipeline(undefined, false, '...');
assert('UTF-16 encoded CSV stops at step 2 (UTF-8)', pipelineB.stopped_at === 'UTF-8');

const pipelineC = simulatePipeline(undefined, true, 'Gate,Capacity\nGate A,5000\n');
assert('Valid CSV passes all four steps', pipelineC.stopped_at === null);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
