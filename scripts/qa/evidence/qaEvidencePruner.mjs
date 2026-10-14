import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { QaResourceCoordinator } from '../runtime/QaResourceCoordinator.mjs';
import { requireQaRetentionRunId } from '../cli/qaRetentionArgs.mjs';
import { writeQaJsonAtomic } from './qaAtomicJson.mjs';
import { inspectQaEvidenceRetention, requireQaEvidenceRoot, measurePlainDirectory } from './qaEvidenceRetention.mjs';

async function requirePlainChild(parent, name) {
  const child = path.join(parent, name);
  try { await fs.mkdir(child); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const stat = await fs.lstat(child);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('QA_EVIDENCE_RETENTION_ROOT_UNSAFE');
  }
  return child;
}

async function withRetentionLock(rootDir, action) {
  const runsRoot = await requireQaEvidenceRoot(rootDir);
  if (runsRoot === null) throw new Error('QA_EVIDENCE_RETENTION_RUNS_MISSING');
  const qaRoot = path.dirname(runsRoot);
  const lockRoot = await requirePlainChild(qaRoot, 'locks');
  const coordinator = new QaResourceCoordinator({ lockRoot, runId: `retention-${randomUUID()}` });
  await coordinator.acquireAll(['evidence:retention']);
  try { return await action(runsRoot, qaRoot); } finally { await coordinator.releaseAll(); }
}

export async function setQaEvidencePin({ rootDir, runId, reason, pinned, now = () => Date.now() }) {
  requireQaRetentionRunId(runId);
  if (typeof pinned !== 'boolean' || (pinned && (typeof reason !== 'string'
    || !reason.trim() || reason.length > 1000))) throw new Error('QA_EVIDENCE_RETENTION_PIN_INVALID');
  return withRetentionLock(rootDir, async (runsRoot) => {
    const runRoot = path.join(runsRoot, runId);
    await measurePlainDirectory(runRoot);
    const pinPath = path.join(runRoot, 'retention-pin.json');
    if (pinned) {
      await writeQaJsonAtomic(pinPath, { contractVersion: 1, runId, reason: reason.trim(),
        pinnedAt: new Date(now()).toISOString() });
    } else {
      await fs.unlink(pinPath);
    }
    return Object.freeze({ status: 'READY', runId, pinned });
  });
}

export async function pruneQaEvidence({ rootDir, now = () => Date.now(), policy } = {}) {
  return withRetentionLock(rootDir, async (runsRoot, qaRoot) => {
    const inspection = await inspectQaEvidenceRetention({ rootDir, now, policy });
    if (inspection.status === 'ATTENTION') throw new Error('QA_EVIDENCE_RETENTION_INSPECTION_UNSAFE');
    const receiptRoot = await requirePlainChild(qaRoot, 'retention');
    const trashRoot = await requirePlainChild(qaRoot, 'retention-trash');
    if ((await fs.readdir(trashRoot)).length) throw new Error('QA_EVIDENCE_RETENTION_TRASH_UNRESOLVED');
    const receiptId = `prune-${new Date(now()).toISOString().replace(/[:.]/gu, '-')}-${randomUUID()}`;
    const receiptPath = path.join(receiptRoot, `${receiptId}.json`);
    const receipt = { contractVersion: 1, status: 'RUNNING', startedAt: new Date(now()).toISOString(),
      policy: inspection.policy, candidates: inspection.candidates, deleted: [], deletedBytes: 0 };
    await writeQaJsonAtomic(receiptPath, receipt);
    try {
      for (const candidate of inspection.candidates) {
        requireQaRetentionRunId(candidate.runId);
        const source = path.join(runsRoot, candidate.runId);
        const removed = path.join(trashRoot, candidate.runId);
        if ((await measurePlainDirectory(source)).fingerprint !== candidate.fingerprint) {
          throw new Error(`QA_EVIDENCE_RETENTION_RUN_CHANGED:${candidate.runId}`);
        }
        // Moving the exact plain run first prevents following a replaced source path.
        await fs.rename(source, removed);
        try {
          if ((await measurePlainDirectory(removed)).fingerprint !== candidate.fingerprint) {
            throw new Error(`QA_EVIDENCE_RETENTION_RUN_CHANGED:${candidate.runId}`);
          }
        } catch (error) { await fs.rename(removed, source); throw error; }
        await fs.rm(removed, { recursive: true, force: false });
        receipt.deleted.push(candidate.runId);
        receipt.deletedBytes += candidate.bytes;
        await writeQaJsonAtomic(receiptPath, receipt);
      }
      receipt.status = 'COMPLETE';
      receipt.finishedAt = new Date(now()).toISOString();
      await writeQaJsonAtomic(receiptPath, receipt);
    } catch (error) {
      receipt.status = 'FAILED';
      receipt.errorCode = error.message;
      await writeQaJsonAtomic(receiptPath, receipt);
      throw error;
    }
    const after = await inspectQaEvidenceRetention({ rootDir, now, policy });
    return Object.freeze({ status: after.status, dryRun: false, receiptPath,
      deletedRunCount: receipt.deleted.length, deletedBytes: receipt.deletedBytes, totals: after.totals });
  });
}
