import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outputDir = path.join(root, '.artifacts', 'flow-temporal');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
const clean = (value) => String(value).replace(/[|\r\n]/g, ' ');
let before = null;
async function publish(report, markdown) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'report.md'), markdown);
}
try {
  await publish({ execution: 'invalid', reason: 'run_in_progress', runId }, '# Temporal flow evaluation\n\nExecution: invalid (running).\n');
  const { snapshotFlowMeasuredSources, assertFlowMeasuredSourcesUnchanged } = await import('./flowMeasuredPressureSources.mjs');
  before = await snapshotFlowMeasuredSources(root);
  if (process.versions.node !== (await readFile(path.join(root, '.nvmrc'), 'utf8')).trim().replace(/^v/, '')) {
    throw new Error('FLOW_TEMPORAL_NODE_VERSION_MISMATCH');
  }
  const { createFlowTemporalCorpus } = await import('./flowTemporalScenarios.mjs');
  const { createTemporalObservationFixture } = await import('./flowTemporalObservationFixture.mjs');
  const { interpretFlowTimeline, FLOW_TEMPORAL_CONFIG } = await import('./flowTemporalInterpretation.mjs');
  const { evaluateFlowTemporal } = await import('./evaluateFlowTemporal.mjs');
  const cases = createFlowTemporalCorpus().map((scenario) => {
    const observation = createTemporalObservationFixture(scenario.input);
    const input = { ...observation, atMs: [20000, 40000, 50000, 60000, 90000] };
    return { id: scenario.id, recipe: scenario.input, review: scenario.review,
      output: interpretFlowTimeline(input), sensitivity: [0.8, 1.25].map((scale) => ({ scale,
        terminal: interpretFlowTimeline({ ...input, atMs: [90000] },
          { timeConstantsMs: FLOW_TEMPORAL_CONFIG.timeConstantsMs.map((value) => value * scale) }).rows[0] })) };
  });
  const assessment = evaluateFlowTemporal(cases);
  await assertFlowMeasuredSourcesUnchanged(root, before);
  const report = { version: 1, execution: 'valid', runId, generatedAt: new Date().toISOString(),
    scope: 'synthetic_descriptive_candidate_no_runtime_or_sites_consumer',
    assessment, cases, sourceSnapshot: { fileCount: before.files.length, ...before.scope }, sourceHashes: before.hashes };
  const display = (value) => value === null ? 'unsupported' : value.toFixed(4);
  const markdown = ['# Temporal flow evaluation', '', `Execution: valid. Review: ${assessment.status}.`, '',
    'Continuous descriptors, not calibrated probabilities or intent/habit labels. All cases are visible development evidence.', '',
    '| Case | Forward/s | Backward/s | Matched area share | Editor focus share | Input recency |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...cases.map((entry) => { const fast = entry.output.rows.at(-1).windows[0];
      return `| ${entry.id} | ${['observedForwardRate', 'observedBackwardRate', 'matchedVisibleAreaShare', 'editorFocusShare', 'inputRecency'].map((key) => display(fast[key])).join(' | ')} |`; }), '',
    ...assessment.checks.map((check) => `- ${check.id}: ${check.status}.`), '',
    'The JSON preserves each physical recipe, intermediate support/missing-data states and fixed 0.8x/1.25x time-scale perturbations. No best parameter is selected.', '',
    'Input events here are a separate authored observation channel. Production feed journals do not yet persist this channel. Geometry holds, identity hypotheses and cursor limits come from the existing observation owners.', '',
    `Sources: ${before.files.length}. Run: ${runId}`, '',].join('\n');
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${runId}.json`), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await publish(report, markdown);
  console.log(JSON.stringify({ execution: 'valid', review: assessment.status, scenarios: cases.length,
    findings: assessment.checks.filter((check) => check.status === 'finding').length, sourceFiles: before.files.length, runId, outputDir }));
  process.exitCode = assessment.status === 'findings' ? 2 : 0;
} catch (error) {
  await publish({ execution: 'invalid', runId, error: String(error), sourceHashes: before === null ? {} : before.hashes },
    `# Temporal flow evaluation\n\nExecution: invalid.\n\n${clean(error)}\n`);
  console.error(String(error)); process.exitCode = 1;
}
