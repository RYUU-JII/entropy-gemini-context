import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outputDir = path.join(root, '.artifacts', 'flow-model-evaluation');
let sourceHashes = {};
const number = (value) => Number(value.toPrecision(7)).toString();

try {
  const { FLOW_BASELINE_SOURCE_FILES } = await import('./flowEvaluationSources.mjs');
  const { readFlowEvaluationHashes, assertFlowEvaluationHashesUnchanged } = await import('./flowEvaluationSourceSnapshot.mjs');
  sourceHashes = await readFlowEvaluationHashes(root, FLOW_BASELINE_SOURCE_FILES);
  // Import/parse failures must also invalidate an earlier successful report.
  const { createFlowModelCorpus } = await import('./flowModelScenarios.mjs');
  const { replayCurrentFlowModel } = await import('./currentFlowModelReplay.mjs');
  const { evaluateFlowModelCorpus } = await import('./evaluateFlowModel.mjs');
  const evaluation = evaluateFlowModelCorpus({ corpus: createFlowModelCorpus(), replayTrace: replayCurrentFlowModel });
  await assertFlowEvaluationHashesUnchanged(root, sourceHashes);
  const report = { generatedAt: new Date().toISOString(), nodeVersion: process.version, sourceHashes, ...evaluation };
  const markdown = [
    '# Synthetic flow model baseline', '',
    `Generated: ${report.generatedAt} · ${report.nodeVersion}`, '',
    `Execution: **${report.execution}**. Model review: **${report.status}**.`, '',
    `Scenarios: ${report.summary.scenarios} (${report.summary.splits.development} development, ${report.summary.splits.held_out} public held-out recipes), ${report.summary.families} families.`, '',
    `Relations: ${report.summary.relations.satisfied} satisfied, ${report.summary.relations.violated} invariant violations, ${report.summary.relations.review} hypotheses for review, ${report.summary.relations.unsupported} unsupported.`, '',
    '**Scope:** shipped default post-confirmation burst/judge/seam, no intervention feedback. This does not reproduce capture, learned profiles, live timer cadence, full attention classification, or Enso admission. Confirmed fresh-item novelty is unmeasured. Input, visibility and provenance are not interpreted. Their timestamps add reconciliation boundaries; unmatched clock schedules can affect output.', '',
    '## Locally persistent changes', '',
    'Each interval below was narrowed 4,096-fold using the model output only to locate sensitivity. These are diagnostic flags, not fitted behavioral cutoffs or proofs of intent.', '',
    '| Sweep | Metric | Narrow input interval | Remaining output change |',
    '| --- | --- | --- | ---: |',
    ...report.persistentJumps.map((jump) => `| ${jump.probeId} | ${jump.metric} | ${jump.refinedParameterRange.map(number).join(' → ')} | ${number(jump.finalDelta)} |`), '',
    '## Relations', '',
    ...report.relations.map((relation) => `- ${relation.id}: **${relation.status}** (${relation.claim}, ${relation.split}); ${relation.changedPoints.length} changed observation points${relation.unsupportedChannels.length ? `; unsupported: ${relation.unsupportedChannels.join(', ')}` : ''}.`), '',
    '## Scope still open', '',
    `- ${report.summary.noConfirmedAdvanceScenarios} scenarios have no confirmed forward advances. They are not a healthy-use classification.`,
    `- ${report.summary.isolatedSupplyCandidates} isolated zero-displacement supply calls emit a candidate; this is candidate-stage review, not a full-runtime false-positive count.`,
    '- Fictional-purpose prose is review material. No intent-accuracy score is calculated.',
    '- Reusing these held-out findings for tuning consumes that split; the next comparison needs fresh recipe mechanisms.',
    '- JSON contains all case endpoints, coverage gaps, relation differences, sweep diagnostics, review notes and source SHA-256 hashes.', '',
  ].join('\n');
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'report.md'), markdown);
  console.log(JSON.stringify({ execution: report.execution, status: report.status, ...report.summary, outputDir }, null, 2));
  process.exitCode = report.status === 'findings' ? 2 : 0;
} catch (error) {
  // An invalid harness must replace any stale successful report.
  await mkdir(outputDir, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), execution: 'invalid', sourceHashes, error: String(error) };
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'report.md'), `# Synthetic flow model baseline\n\nExecution: **invalid**.\n\n${String(error)}\n`);
  console.error(String(error));
  process.exitCode = 1;
}
