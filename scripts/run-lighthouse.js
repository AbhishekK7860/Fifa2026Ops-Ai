/**
 * Lighthouse runner script — targets /dashboard and / in sequence.
 * Outputs exactly the 4 category scores + 3 Core Web Vitals.
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const URLS = [
  { url: 'http://localhost:3000/dashboard', label: '/dashboard (blocking gate)' },
  { url: 'http://localhost:3000/', label: '/ (landing, non-blocking)' }
];

const outDir = os.tmpdir();

for (const { url, label } of URLS) {
  const outFile = path.join(outDir, `lighthouse-${label.replace(/[^a-z0-9]/gi, '-')}.json`);
  
  console.log(`\n=== Lighthouse: ${label} ===`);
  console.log(`URL: ${url}`);
  
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npxCmd, [
    'lighthouse', url,
    '--chrome-flags=--headless --no-sandbox --disable-gpu',
    '--output=json',
    `--output-path=${outFile}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--quiet'
  ], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 120000, shell: true });

  if (result.error) {
    console.log('Spawn error:', result.error);
    continue;
  }
  if (result.status !== 0) {
    console.log('Lighthouse exited with code', result.status);
    console.log('stderr:', result.stderr ? result.stderr.substring(0, 1000) : 'none');
    console.log('stdout:', result.stdout ? result.stdout.substring(0, 500) : 'none');
    if (!fs.existsSync(outFile)) continue;
  }

  if (!fs.existsSync(outFile)) {
    console.log('Output file not found');
    continue;
  }

  const report = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  
  const categories = report.categories;
  const audits = report.audits;

  console.log('\n--- Category Scores ---');
  const perf = Math.round((categories.performance?.score ?? 0) * 100);
  const a11y = Math.round((categories.accessibility?.score ?? 0) * 100);
  const bp = Math.round((categories['best-practices']?.score ?? 0) * 100);
  const seo = Math.round((categories.seo?.score ?? 0) * 100);
  console.log(`Performance:    ${perf}  ${perf >= 90 ? '✅ PASS' : '❌ FAIL (threshold: ≥90)'}`);
  console.log(`Accessibility:  ${a11y}  ${a11y >= 95 ? '✅ PASS' : '❌ FAIL (threshold: ≥95)'}`);
  console.log(`Best Practices: ${bp}  ${bp >= 95 ? '✅ PASS' : '❌ FAIL (threshold: ≥95)'}`);
  console.log(`SEO:            ${seo}  (record-only, non-blocking)`);
  
  console.log('\n--- Core Web Vitals (lab-simulated, not field data) ---');
  const lcp = audits['largest-contentful-paint']?.displayValue;
  const tbt = audits['total-blocking-time']?.displayValue;
  const cls = audits['cumulative-layout-shift']?.displayValue;
  console.log(`LCP: ${lcp}`);
  console.log(`TBT (lab proxy for INP): ${tbt}`);
  console.log(`CLS: ${cls}`);

  console.log('\n--- Top Performance Findings ---');
  const opportunities = Object.values(report.audits).filter(a =>
    a.details?.type === 'opportunity' && a.score !== null && a.score < 1
  ).sort((a, b) => (b.details?.overallSavingsMs || 0) - (a.details?.overallSavingsMs || 0));
  for (const opp of opportunities.slice(0, 5)) {
    console.log(`  - [${opp.id}]: ${opp.title} (savings: ${opp.details?.overallSavingsMs?.toFixed(0) || '?'}ms)`);
  }
}
