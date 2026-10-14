import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateConsumptionJourneys } from './evaluateJourneys.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const options = { seed: 20260909, perProfile: 30 };
for (const arg of process.argv.slice(2)) {
  const match = /^--(seed|per-profile)=(\d+)$/.exec(arg);
  if (!match) throw new Error(`JOURNEY_EVALUATION_ARGUMENT_INVALID:${arg}`);
  options[match[1] === 'seed' ? 'seed' : 'perProfile'] = Number(match[2]);
}
async function sourceHashes() {
  const hashes = {}, visited = new Set();
  async function visit(absolute) {
    if (visited.has(absolute)) return;
    visited.add(absolute);
    const data = await fs.readFile(absolute);
    hashes[path.relative(root, absolute).replaceAll('\\', '/')] = createHash('sha256').update(data).digest('hex');
    if (!/\.[cm]?js$/.test(absolute)) return;
    for (const [, specifier] of data.toString().matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('.')) await visit(path.resolve(path.dirname(absolute), specifier));
    }
  }
  await visit(fileURLToPath(import.meta.url));
  await visit(path.join(root, 'package-lock.json'));
  return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
}
const before = await sourceHashes();
const report = await evaluateConsumptionJourneys({ ...options,
  onProgress: (progress) => console.log(JSON.stringify({ event: 'CONSUMPTION_JOURNEY_PROGRESS', ...progress })) });
const after = await sourceHashes();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('JOURNEY_EVALUATION_SOURCE_CHANGED');
report.sourceHashes = after;
const folder = path.join(root, '.artifacts', 'consumption-journeys', `seed-${options.seed}-count-${options.perProfile}`);
await fs.mkdir(folder, { recursive: true });
await fs.writeFile(path.join(folder, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const lines = ['# Observed consumption journey replay', '',
  `${report.status}; readiness ${report.readiness}. ${report.sourcePatterns} synthetic eight-hour source patterns; ${report.pairedComparisons} paired policy comparisons.`, '',
  report.interpretation, '',
  '| Profile / consent / reaction | Pairs | Fixed gates | Adaptive gates | Fixed wait (s) | Adaptive wait (s) | Pairs with more / fewer gates |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
for (const [key, row] of Object.entries(report.groups)) lines.push(`| ${key} | ${row.pairs} | ${row.fixedShown} | ${row.adaptiveShown} | ${(row.fixedWaitMs / 1000).toFixed(1)} | ${(row.adaptiveWaitMs / 1000).toFixed(1)} | ${row.adaptiveMoreGates} / ${row.adaptiveFewerGates} |`);
lines.push('', ...report.contracts.map((item) => `- ${item.passed ? 'PASS' : 'FAIL'}: ${item.name}${item.error ? ` — ${item.error}` : ''}`), '', ...report.limitations.map((item) => `- ${item}`));
await fs.writeFile(path.join(folder, 'summary.md'), `${lines.join('\n')}\n`);
console.log(JSON.stringify({ event: 'CONSUMPTION_JOURNEY_EVALUATION_COMPLETE', status: report.status,
  sourcePatterns: report.sourcePatterns, sourceIntervals: report.sourceIntervals, pairedComparisons: report.pairedComparisons,
  contracts: report.contracts.length, failedContracts: report.contracts.filter((item) => !item.passed), failures: report.failures.length,
  readiness: report.readiness, reportPath: path.join(folder, 'report.json') }));
if (report.status !== 'PASS') process.exitCode = 1;
