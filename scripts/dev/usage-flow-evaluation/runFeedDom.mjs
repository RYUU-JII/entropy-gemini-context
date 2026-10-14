import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { evaluateFeedDom } from './evaluateFeedDom.mjs';
import { feedDomScenarios, feedIdentityScenarios } from './domScenarios.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(root, '.artifacts/feed-dom-evaluation');
const result = evaluateFeedDom({ scenes: feedDomScenarios, identities: feedIdentityScenarios });
const files = [
  'scripts/dev/usage-flow-evaluation/domScenarios.mjs',
  'scripts/dev/usage-flow-evaluation/evaluateFeedDom.mjs',
  'scripts/dev/usage-flow-evaluation/runFeedDom.mjs',
  ...['discovery/feedItemBoundaries.js', 'discovery/feedItemContentIdentity.js',
    'discovery/genericFeedItemFeatures.js', 'discovery/GenericFeedItemDiscovery.js',
    'classify/GenericSurfaceClassifier.js', 'learning/FeedStructureLearner.js',
    'observation/readFeedRegionSnapshot.js'].map((file) => `src/domains/nudge/feed-flow/${file}`),
];
const sourceHashes = Object.fromEntries(await Promise.all(files.map(async (file) => [
  file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex'),
])));
const report = {
  generatedAt: new Date().toISOString(), nodeVersion: process.version, sourceHashes, ...result,
  notEvaluated: ['Browser layout and real-site accuracy', 'Occlusion, gaze, reading, intention',
    'Live user/programmatic movement attribution', 'Attribute-only recycling delivery',
    'Intervention behavior and browser-wide temporal integration'],
};
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(output, 'report.md'), [
  '# Feed DOM contract evaluation', '', `Synthetic contract: **${result.status}**`, '',
  '| Scenario | Result |', '| --- | --- |',
  ...result.results.map((entry) => `| ${entry.id} | ${entry.status} |`), '',
  '## Not evaluated', '', ...report.notEvaluated.map((entry) => `- ${entry}`), '',
].join('\n'));
console.log(`[feed-dom-evaluation] ${result.status}: ${result.results.filter((entry) => entry.status === 'pass').length}/${result.results.length} scenarios; ${path.join(output, 'report.json')}`);
for (const entry of result.results.filter((entry) => entry.status !== 'pass')) console.error(JSON.stringify(entry));
if (result.status !== 'pass') process.exitCode = 1;
