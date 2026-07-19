"use strict";
/**
 * Phase 3 verification script — run with: node scripts/verify-phase3.mjs
 *
 * Note: To test the actual /api/analyze route, we'd need Next.js running.
 * Instead, this script unit-tests the core Phase 3 logic directly:
 * A. Offline mode generates full schema (no nulls)
 * B. Confidence bound clamping works correctly (±15)
 * C. Rate limiter returns false on 11th request
 * D. No OPENROUTER API key leaks in client code
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const offlineAnalysis_js_1 = require("../src/features/ai-analysis/services/offlineAnalysis.js");
const responseParser_js_1 = require("../src/features/ai-analysis/services/responseParser.js");
const rateLimit_js_1 = require("../src/lib/rateLimit.js");
const __dirname = path_1.default.dirname((0, url_1.fileURLToPath)(import.meta.url));
const ROOT = path_1.default.join(__dirname, '..');
let passed = 0;
let failed = 0;
function assert(label, condition, detail = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    }
    else {
        console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
        failed++;
    }
}
// Dummy GateRow for testing
const dummyRow = {
    gate: 'Gate A',
    capacity: 5000,
    currentVisitors: 4850,
    queueLength: 480,
    volunteerCount: 3,
    status: 'critical',
    transportDelay: 25,
    weather: 'Sunny',
    medicalIncidents: 3,
};
const dummyBound = {
    value: 70,
    completenessSignal: 1,
    agreementSignal: 0.5,
    recencySignal: 1
};
// ─── A. Offline Mode ──────────────────────────────────────────────────────────
console.log('\n── A. Offline Mode ─────────────────────────────────────────────────────────');
const offlineResult = (0, offlineAnalysis_js_1.runOfflineAnalysis)(dummyRow, 'What should I do?', dummyBound);
const hasEmptyString = (obj) => {
    if (typeof obj === 'string')
        return obj.trim() === '';
    if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj).some(val => hasEmptyString(val));
    }
    return false;
};
assert('Offline result generates observation', !!offlineResult.observation);
assert('Offline result generates reasoning', !!offlineResult.reasoning);
assert('Offline result generates recommendedAction', !!offlineResult.recommendedAction);
assert('Offline result generates expectedImpact', !!offlineResult.expectedImpact);
assert('Offline result generates confidence (score & basis)', offlineResult.confidence.score === 70 && !!offlineResult.confidence.basis);
assert('Offline result generates multilingual (en, es, fr)', !!offlineResult.multilingualAnnouncement.en && !!offlineResult.multilingualAnnouncement.es && !!offlineResult.multilingualAnnouncement.fr);
assert('Offline result generates sourceDataRefs', offlineResult.sourceDataRefs.length > 0);
assert('No empty strings in offline result', !hasEmptyString(offlineResult));
// ─── B. Confidence Clamping ───────────────────────────────────────────────────
console.log('\n── B. Confidence Clamping ──────────────────────────────────────────────────');
const validAIJson = (score) => JSON.stringify({
    observation: 'obs',
    reasoning: 'reas',
    recommendedAction: 'act',
    expectedImpact: 'imp',
    confidence: {
        score,
        basis: 'basis'
    },
    multilingualAnnouncement: { en: 'en', es: 'es', fr: 'fr' },
    sourceDataRefs: ['ref']
});
// Bound is 70. Allowed range is 55 to 85.
const r1 = (0, responseParser_js_1.parseAndValidateResponse)(validAIJson(75), dummyBound);
assert('Score 75 (within ±15 of 70) remains 75', r1.confidence.score === 75);
const r2 = (0, responseParser_js_1.parseAndValidateResponse)(validAIJson(80), dummyBound);
assert('Score 80 (within ±15 of 70) remains 80', r2.confidence.score === 80);
const r3 = (0, responseParser_js_1.parseAndValidateResponse)(validAIJson(90), dummyBound);
assert('Score 90 (above ±15 of 70) clamped down to 85', r3.confidence.score === 85);
const r4 = (0, responseParser_js_1.parseAndValidateResponse)(validAIJson(40), dummyBound);
assert('Score 40 (below ±15 of 70) clamped up to 55', r4.confidence.score === 55);
// ─── C. Rate Limiting ─────────────────────────────────────────────────────────
console.log('\n── C. Rate Limiting ────────────────────────────────────────────────────────');
const testIP = '192.168.1.100';
let lastResult;
for (let i = 0; i < 10; i++) {
    lastResult = (0, rateLimit_js_1.checkRateLimit)(testIP);
}
assert('10th request is allowed', lastResult.allowed === true);
const eleventhResult = (0, rateLimit_js_1.checkRateLimit)(testIP);
assert('11th request is denied', eleventhResult.allowed === false);
assert('11th request has retryAfterMs > 0', eleventhResult.retryAfterMs > 0);
// ─── D. Client-side key leakage check ─────────────────────────────────────────
console.log('\n── D. Client-side Key Leakage Check ────────────────────────────────────────');
try {
    // We use grep in child_process, or just standard Node.js readdir recursive to be OS agnostic
    const srcAppDir = path_1.default.join(ROOT, 'src', 'app');
    function findInFiles(dir, regex) {
        const files = fs_1.default.readdirSync(dir);
        for (const file of files) {
            const fullPath = path_1.default.join(dir, file);
            const stat = fs_1.default.statSync(fullPath);
            if (stat.isDirectory()) {
                if (findInFiles(fullPath, regex))
                    return true;
            }
            else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
                // Exclude the API routes since they run server-side and SHOULD contain the key
                if (!fullPath.includes(path_1.default.sep + 'api' + path_1.default.sep)) {
                    const content = fs_1.default.readFileSync(fullPath, 'utf8');
                    if (regex.test(content)) {
                        console.log(`Found ${regex} in ${fullPath}`);
                        return true;
                    }
                }
            }
        }
        return false;
    }
    const hasKey = findInFiles(srcAppDir, /OPENROUTER/i);
    assert('No OPENROUTER keys in client-side code', hasKey === false);
}
catch (e) {
    assert('No OPENROUTER keys in client-side code', false, e.message);
}
// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
