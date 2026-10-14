import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outputDir = path.join(root, '.artifacts', 'flow-preparation');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
let before = null;
async function publish(report, markdown) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'report.md'), markdown);
}
try {
  await publish({ execution: 'invalid', reason: 'run_in_progress', runId }, '# Flow preparation evaluation\n\nExecution: invalid (running).\n');
  const { snapshotFlowMeasuredSources, assertFlowMeasuredSourcesUnchanged } = await import('./flowMeasuredPressureSources.mjs');
  before = await snapshotFlowMeasuredSources(root);
  if (process.versions.node !== (await readFile(path.join(root, '.nvmrc'), 'utf8')).trim().replace(/^v/, '')) {
    throw new Error('FLOW_PREPARATION_NODE_VERSION_MISMATCH');
  }
  const { createFlowPreparationCorpus, FLOW_PREPARATION_REVIEW_TIMES } = await import('./flowPreparationScenarios.mjs');
  const { createTemporalObservationFixture } = await import('./flowTemporalObservationFixture.mjs');
  const { evaluateFlowPreparation, FLOW_PREPARATION_CONFIG } = await import('./flowPreparationPolicy.mjs');
  const { FLOW_TEMPORAL_CONFIG } = await import('./flowTemporalInterpretation.mjs');
  const { assessFlowPreparation } = await import('./assessFlowPreparation.mjs');
  const corpus = createFlowPreparationCorpus();
  const inputs = corpus.map((scenario) => ({ ...createTemporalObservationFixture(scenario.input, scenario.fixture),
    atMs: FLOW_PREPARATION_REVIEW_TIMES }));
  const cases = corpus.map((scenario, i) => ({ ...scenario, output: evaluateFlowPreparation(inputs[i]) }));
  const assessment = assessFlowPreparation(cases);
  const sensitivity = [];
  // Fixed independent perturbations; all results are retained, no winner chosen.
  for (const axis of ['mass_scale', 'renewal_mass_scale', 'time_constants', 'physical_speed']) for (const scale of [0.8, 1.25]) {
    const variants = corpus.map((scenario, i) => {
      const recipe = structuredClone(scenario.input);
      if (axis === 'physical_speed') for (const phase of recipe.phases) phase.velocity *= scale;
      const input = axis === 'physical_speed'
        ? { ...createTemporalObservationFixture(recipe, scenario.fixture), atMs: FLOW_PREPARATION_REVIEW_TIMES } : inputs[i];
      const output = evaluateFlowPreparation(input,
        { forwardMassScale: FLOW_PREPARATION_CONFIG.forwardMassScale * (axis === 'mass_scale' ? scale : 1),
          renewalMassScale: FLOW_PREPARATION_CONFIG.renewalMassScale * (axis === 'renewal_mass_scale' ? scale : 1) },
        { timeConstantsMs: FLOW_TEMPORAL_CONFIG.timeConstantsMs.map((value) => value * (axis === 'time_constants' ? scale : 1)) });
      return { id: scenario.id, output };
    });
    sensitivity.push({ axis, scale, assessment: assessFlowPreparation(variants),
      cases: variants.map(({ id, output }) => ({ id, rows: output.rows })) });
  }
  await assertFlowMeasuredSourcesUnchanged(root, before);
  const review = [assessment, ...sensitivity.map((entry) => entry.assessment)].some((entry) => entry.status === 'findings')
    ? 'findings' : 'preparation_contracts_satisfied';
  const report = { version: 1, execution: 'valid', review, runId, generatedAt: new Date().toISOString(),
    scope: 'synthetic_preparation_policy_no_runtime_admission_or_sites_consumer', assessment, cases, sensitivity,
    sourceSnapshot: { fileCount: before.files.length, ...before.scope }, sourceHashes: before.hashes };
  const display = (value) => value === null ? 'withheld' : value.toFixed(4);
  const markdown = ['# Flow preparation evaluation', '', `Execution: valid. Review: ${review}.`, '',
    'Policy weights from visible synthetic recipes; no behavioral accuracy or optimal timing claim.', '',
    '| Case | Terminal interest | Writing protection | Opportunity | Preparation score |',
    '| --- | ---: | ---: | ---: | ---: |', ...cases.map((entry) => { const row = entry.output.rows.at(-1);
      return `| ${entry.id} | ${['preparationInterest', 'writingProtection', 'opportunityWeight', 'preparationScore'].map((key) => display(row[key])).join(' | ')} |`; }), '',
    ...assessment.checks.map((check) => `- ${check.id}: ${check.status}.`), '',
    ...sensitivity.map((entry) => `- ${entry.axis} x${entry.scale}: ${entry.assessment.checks.filter((c) => c.status === 'finding').map((c) => c.id).join(', ') || 'no contract findings'}.`), '',
    ...assessment.unresolved.map((value) => `- Unresolved: ${value}`), '',
    'JSON retains the recipes, descriptors, component weights, withholding reasons and fixed perturbations. Findings do not invalidate execution or choose parameters.', '',
    `Sources: ${before.files.length}. Run: ${runId}`, '',].join('\n');
  await writeFile(path.join(outputDir, `${runId}.json`), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await publish(report, markdown);
  console.log(JSON.stringify({ execution: 'valid', review, scenarios: cases.length,
    findings: assessment.checks.filter((c) => c.status === 'finding').length,
    perturbations: sensitivity.length, sourceFiles: before.files.length, runId, outputDir }));
  process.exitCode = review === 'findings' ? 2 : 0;
} catch (error) {
  const detail = { error: String(error), changedFiles: error.changedFiles, addedFiles: error.addedFiles, removedFiles: error.removedFiles };
  await publish({ execution: 'invalid', runId, ...detail, sourceHashes: before === null ? {} : before.hashes },
    `# Flow preparation evaluation\n\nExecution: invalid.\n\n${String(error).replace(/[\r\n]/g, ' ')}\n`);
  console.error(JSON.stringify(detail)); process.exitCode = 1;
}
