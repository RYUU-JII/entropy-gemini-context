import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { evaluateUsageFlowCorpus } from './evaluateUsageFlow.mjs';
import { runContinuousTempoProbe } from './continuousTempoProbe.mjs';
import {
  usageFlowScenarioCorpusVersion, usageFlowScenarios, usageFlowScenarioRelations,
} from './scenarios.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outputDir = path.join(root, '.artifacts', 'usage-flow-evaluation');
const measurement = evaluateUsageFlowCorpus({ scenarios: usageFlowScenarios, relations: usageFlowScenarioRelations });
const continuousTempo = runContinuousTempoProbe();
if (continuousTempo.checks.length === 0) throw new Error('USAGE_FLOW_CONTINUOUS_PROBE_CHECKS_REQUIRED');
const sourceFiles = [
  'src/domains/nudge/feed-flow/observation/UsageFlowObservationWindow.js',
  'src/domains/nudge/feed-flow/tempo/feedTempoAdaptiveProfileModel.js',
  'src/domains/nudge/feed-flow/tempo/feedTempoContracts.js',
  'src/domains/nudge/feed-flow/tempo/FeedTempoEpisodeAssembler.js',
  'src/platform/storage/model/FeedTempoProfileCheckpointContract.js',
  'scripts/dev/usage-flow-evaluation/scenarios.mjs',
  'scripts/dev/usage-flow-evaluation/evaluateUsageFlow.mjs',
  'scripts/dev/usage-flow-evaluation/continuousTempoProbe.mjs',
  'scripts/dev/usage-flow-evaluation/run.mjs',
];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [
  file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex'),
])));
const report = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  corpusVersion: usageFlowScenarioCorpusVersion,
  sourceHashes,
  status: measurement.status === 'pass' && continuousTempo.checks.every((check) => check.passed) ? 'pass' : 'fail',
  measurement,
  continuousTempo,
  scopeLimits: [
    'PASS means synthetic measurement contracts and continuous quantity semantics passed. It does not validate intention, browser capture, or intervention behavior.',
    'The new observation window is an offline replay input seam. Live capture does not yet supply its coverage/source contract; no new observed-time history or browser-wide tracking is enabled.',
    'Natural-language oracle conclusions are review criteria and are not scored as automatic intent tests.',
    'Identical traces with different fictional intentions are unidentifiable. Equal whole-window rates also discard temporal rhythm.',
  ],
};
const number = (value) => value === null ? 'unknown' : Number(value.toFixed(4)).toString();
const rows = measurement.scenarios.map((scenario) => {
  if (scenario.status === 'invalid') return `| ${scenario.id} | invalid | — | — | — | — |`;
  const m = scenario.measurements;
  return `| ${scenario.id} | ${scenario.status} | ${number(m.feedObservedVisibleMs / 1000)} | ${number(m.userScreenfuls)} | ${number(m.screenfulsPerObservedMinute)} | ${number(m.typingEvents + m.compositionEvents + m.pasteEvents)} |`;
});
const markdown = [
  '# Usage flow measurement evaluation', '',
  `Generated: ${report.generatedAt} · corpus ${report.corpusVersion} · ${report.nodeVersion}`, '',
  `Synthetic measurement contract: **${measurement.status.toUpperCase()}** (${measurement.passedScenarioCount}/${measurement.expectedScenarioCount} scenarios; ${measurement.passedRelationCount}/${measurement.relationCount} relations).`, '',
  `Production continuous quantity semantics: **${continuousTempo.checks.filter((check) => check.passed).length}/${continuousTempo.checks.length} checks**.`, '',
  '**Behavioral validity, live capture accuracy, and intervention behavior: not evaluated.**', '',
  '| Scenario | Measurement contract | Feed observed visible s | Confirmed user screenfuls | Confirmed user screenfuls / observed min | Observed input events |',
  '| --- | --- | ---: | ---: | ---: | ---: |', ...rows, '',
  '## Interpretation limits', '', ...report.scopeLimits.map((limit) => `- ${limit}`), '',
  '## Production quantity probes', '',
  ...continuousTempo.checks.map((check) => `- ${check.passed ? 'PASS' : 'FAIL'}: ${check.id}`), '',
  ...continuousTempo.limitations.map((limit) => `- ${limit}`), '',
  'Detailed expectations, failures, inference review notes, and source SHA-256 hashes are in report.json.', '',
].join('\n');
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(outputDir, 'report.md'), markdown);
console.log(JSON.stringify({ status: report.status,
  scenarios: `${measurement.passedScenarioCount}/${measurement.expectedScenarioCount}`,
  relations: `${measurement.passedRelationCount}/${measurement.relationCount}`,
  productionQuantityChecks: `${continuousTempo.checks.filter((check) => check.passed).length}/${continuousTempo.checks.length}`,
  behavioralValidity: 'not_evaluated', outputDir,
}, null, 2));
if (report.status !== 'pass') process.exitCode = 1;
