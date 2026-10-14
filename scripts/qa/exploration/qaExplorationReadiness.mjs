import fs from 'node:fs/promises';
import path from 'node:path';
import { readQaExplorationJson, requireQaExplorationDirectory } from './qaExplorationEvidence.mjs';

const RELOAD_RUN_ID = /^\d{17}-qa-extension-reload-[a-f0-9]{8}$/u;

// A prior exact run is useful context, never a claim about today's live worker.
export async function readQaExplorationReadiness({ rootDir }) {
  let runsRoot;
  try {
    runsRoot = await requireQaExplorationDirectory(rootDir, ['.artifacts', 'qa', 'runs']);
  } catch (error) {
    if (error.code === 'ENOENT') return Object.freeze({ status: 'absent', liveBuildProved: false });
    throw error;
  }
  const candidates = (await fs.readdir(runsRoot, { withFileTypes: true }))
    .filter((entry) => RELOAD_RUN_ID.test(entry.name))
    .sort((left, right) => right.name.localeCompare(left.name));
  if (candidates.length === 0) return Object.freeze({ status: 'absent', liveBuildProved: false });
  const entry = candidates[0];
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('QA_EXPLORATION_READINESS_PATH_INVALID');
  const runRoot = await requireQaExplorationDirectory(rootDir, ['.artifacts', 'qa', 'runs', entry.name]);
  const runPath = path.join(runRoot, 'run.json');
  let run;
  try {
    run = await readQaExplorationJson(runPath);
  } catch (error) {
    if (error.code === 'ENOENT') return Object.freeze({ status: 'pending', runId: entry.name, liveBuildProved: false });
    throw error;
  }
  if (run?.contractVersion !== 2 || run.runId !== entry.name || run.targetId !== 'qa/extension-reload'
    || !['PASS', 'FAIL', 'BLOCKED', 'INCONCLUSIVE'].includes(run.status)
    || !Number.isFinite(Date.parse(run.finishedAt))) throw new Error('QA_EXPLORATION_READINESS_RECORD_INVALID');
  if (run.status !== 'PASS') return Object.freeze({ status: 'recorded_unsuccessful',
    runId: run.runId, recordedVerdict: run.status, finishedAt: run.finishedAt,
    evidencePath: runPath, liveBuildProved: false });
  const receipt = run.result;
  if (receipt?.status !== 'PASS' || receipt.runtimeReadyProved !== true
    || typeof receipt.buildId !== 'string' || !receipt.buildId
    || typeof receipt.extensionId !== 'string' || !receipt.extensionId
    || receipt.readiness?.runtimeReady !== true
    || receipt.readiness.artifactRuntimeIdentity?.buildId !== receipt.buildId) {
    throw new Error('QA_EXPLORATION_READINESS_RECEIPT_INVALID');
  }
  return Object.freeze({ status: 'historical_verified_reload', runId: run.runId,
    recordedVerdict: run.status, finishedAt: run.finishedAt, buildId: receipt.buildId,
    extensionId: receipt.extensionId, evidencePath: runPath, liveBuildProved: false,
    scope: 'Exact prior reload evidence; current live build remains unproved by exploration inspection.' });
}
