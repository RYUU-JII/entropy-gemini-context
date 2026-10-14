import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateConsumptionMemory } from './evaluate.mjs';
import { CONSUMPTION_MEMORY_PROFILE } from '../../../src/domains/behavior/consumption/consumptionMemoryModel.js';
import { SHISHI_CONSUMPTION_PROFILE } from '../../../src/domains/protection/domain/shishiConsumptionLevel.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const sourceFiles = [
  'src/domains/behavior/consumption/consumptionMemoryModel.js',
  'src/domains/protection/domain/shishiConsumptionLevel.js',
  'src/domains/settings/config/gateConfig.js',
  'scripts/dev/consumption-memory-evaluation/patternGenerator.mjs',
  'scripts/dev/consumption-memory-evaluation/scenarios.mjs',
  'scripts/dev/consumption-memory-evaluation/evaluate.mjs',
  'scripts/dev/consumption-memory-evaluation/run.mjs',
];
const options = { seed: 20260909, perProfile: 400 };
for (const arg of process.argv.slice(2)) {
  const match = /^--(seed|per-profile)=(\d+)$/.exec(arg);
  if (!match) throw new Error(`CONSUMPTION_EVALUATION_ARGUMENT_INVALID:${arg}`);
  options[match[1] === 'seed' ? 'seed' : 'perProfile'] = Number(match[2]);
}
async function hashes() {
  return Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file,
    createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex')])));
}
const before = await hashes();
const report = evaluateConsumptionMemory(options);
const after = await hashes();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('CONSUMPTION_EVALUATION_SOURCE_CHANGED');
report.sourceHashes = after;
report.modelProfile = CONSUMPTION_MEMORY_PROFILE;
report.levelProfile = SHISHI_CONSUMPTION_PROFILE;
const folder = path.join(root, '.artifacts', 'consumption-memory', `seed-${options.seed}-count-${options.perProfile}`);
await fs.mkdir(folder, { recursive: true });
await fs.writeFile(path.join(folder, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const lines = [
  '# Consumption memory candidate evaluation', '',
  `Status: ${report.status}. Readiness: ${report.readiness}. Synthetic workloads only; no human-intention accuracy claim.`, '',
  `Seed ${report.seed}; ${report.generatedRuns} generated eight-hour patterns; ${report.intervalCount} source intervals; ${report.invariantChecks} invariant checks. Largest serialized state: ${report.maxSerializedStateBytes} bytes.`, '',
  '| Profile | Patterns | Potential entry boundaries | Light | Medium | High | Remembered / unknown | Baseline | Mean final memory |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
];
for (const [id, summary] of Object.entries(report.profiles)) lines.push(`| ${id} | ${summary.runs} | ${summary.entries} | ${summary.bands.light} | ${summary.bands.medium} | ${summary.bands.high} | ${summary.bands.remembered} | ${summary.bands.baseline} | ${summary.meanFinalMemory.toFixed(4)} |`);
lines.push('', 'Counts classify candidate levels at synthetic entry boundaries; existing Gate passes and intervention admission are not simulated.', '',
  '| Scenario | Final memory | Coverage | Overflow extension (ms) |', '| --- | ---: | --- | ---: |');
for (const scenario of report.scenarios) lines.push(`| ${scenario.id} | ${scenario.final.memory.toFixed(4)} | ${scenario.final.coverage.status} | ${scenario.level.waitExtensionMs} |`);
lines.push('', ...report.relationships.map((check) => `- ${check.passed ? 'PASS' : 'FAIL'}: ${check.name}`), '',
  `Maximum partition error: ${report.maxPartitionError}; restore/read/replay error: ${report.maxRestoreError}; one-second memory change: ${report.maxOneSecondPerturbation}.`, '',
  `Observed one-second hold change: ${report.maxObservedHoldDeltaMs} ms. Coverage transition audit: ${report.coverageTransitionAudit.status}; maximum unknown-to-observed change ${report.coverageTransitionAudit.maxHoldDeltaMs} ms. Explicit mode transition maximum: ${report.coverageTransitionAudit.maxExplicitModeHoldDeltaMs} ms.`, '',
  report.coverageTransitionAudit.interpretation, '',
  ...report.limitations.map((limitation) => `- ${limitation}`));
await fs.writeFile(path.join(folder, 'summary.md'), `${lines.join('\n')}\n`);
console.log(JSON.stringify({ event: 'CONSUMPTION_MEMORY_EVALUATION_COMPLETE', status: report.status,
  patterns: report.generatedRuns, intervals: report.intervalCount, invariantChecks: report.invariantChecks,
  readiness: report.readiness, coverageAudit: report.coverageTransitionAudit,
  failedRelationships: report.relationships.filter((check) => !check.passed), failures: report.failures.length,
  reportPath: path.join(folder, 'report.json'), summaryPath: path.join(folder, 'summary.md') }));
if (report.status !== 'PASS') process.exitCode = 1;
