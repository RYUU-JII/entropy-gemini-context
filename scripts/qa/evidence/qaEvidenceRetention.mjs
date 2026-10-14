import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const RUN_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,159})$/u;
const TERMINAL_STATUSES = new Set([
  'PASS',
  'FAIL',
  'BLOCKED',
  'INCONCLUSIVE',
  'READY_FOR_HUMAN',
]);

export const QA_EVIDENCE_RETENTION_POLICY = Object.freeze({
  maxAgeDays: 7,
  keepPerTarget: 3,
  minAgeHours: 24,
  maxBytes: 10_000_000_000,
});

function requirePolicy(policy) {
  const maxAgeDays = Number(policy?.maxAgeDays);
  const keepPerTarget = Number(policy?.keepPerTarget);
  const minAgeHours = Number(policy.minAgeHours);
  const maxBytes = Number(policy.maxBytes);
  if (
    !Number.isSafeInteger(maxAgeDays)
    || maxAgeDays < 1
    || maxAgeDays > 3650
    || !Number.isSafeInteger(keepPerTarget)
    || keepPerTarget < 1
    || keepPerTarget > 1000
    || !Number.isSafeInteger(minAgeHours) || minAgeHours < 1
    || minAgeHours > maxAgeDays * 24
    || !Number.isSafeInteger(maxBytes) || maxBytes < 1
  ) {
    throw new Error('QA_EVIDENCE_RETENTION_POLICY_INVALID');
  }
  return Object.freeze({ maxAgeDays, keepPerTarget, minAgeHours, maxBytes });
}

// Only this declared evidence subtree is eligible. Check each ancestor before IO.
export async function requireQaEvidenceRoot(rootDir) {
  if (typeof rootDir !== 'string' || !path.isAbsolute(rootDir)) {
    throw new Error('QA_EVIDENCE_RETENTION_ROOT_ABSOLUTE_REQUIRED');
  }
  let current = path.resolve(rootDir);
  for (const segment of ['', '.artifacts', 'qa', 'runs']) {
    if (segment) current = path.join(current, segment);
    let stat;
    try { stat = await fs.lstat(current); } catch (error) {
      if (error.code === 'ENOENT' && segment) return null;
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error('QA_EVIDENCE_RETENTION_ROOT_UNSAFE');
    }
  }
  return current;
}

async function readJson(filePath) {
  try {
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) {
      return Object.freeze({ status: 'invalid' });
    }
    return Object.freeze({
      status: 'valid',
      value: JSON.parse(await fs.readFile(filePath, 'utf8')),
    });
  } catch (error) {
    if (error?.code === 'ENOENT') return Object.freeze({ status: 'missing' });
    return Object.freeze({ status: 'invalid' });
  }
}

export async function measurePlainDirectory(directoryPath) {
  const rootStat = await fs.lstat(directoryPath);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('QA_EVIDENCE_RETENTION_RUN_ROOT_UNSAFE');
  }
  let bytes = 0;
  let fileCount = 0;
  const identity = createHash('sha256');
  identity.update(`${rootStat.dev}:${rootStat.ino}`);
  const pending = [directoryPath];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '.git') throw new Error('QA_EVIDENCE_RETENTION_CHECKOUT_FORBIDDEN');
      const entryPath = path.join(current, entry.name);
      const stat = await fs.lstat(entryPath);
      if (stat.isSymbolicLink()) {
        throw new Error('QA_EVIDENCE_RETENTION_SYMLINK_FORBIDDEN');
      }
      if (stat.isDirectory()) {
        pending.push(entryPath);
      } else if (stat.isFile()) {
        bytes += stat.size;
        fileCount += 1;
        identity.update(JSON.stringify([path.relative(directoryPath, entryPath),
          stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs]));
      } else {
        throw new Error('QA_EVIDENCE_RETENTION_ENTRY_TYPE_UNSAFE');
      }
    }
  }
  return Object.freeze({ bytes, fileCount, fingerprint: identity.digest('hex') });
}

function inspectTerminalEvidence(runId, runState, cleanupState) {
  const report = runState.status === 'valid' ? runState.value : null;
  const cleanup = cleanupState.status === 'valid' ? cleanupState.value : null;
  if (
    !report
    || typeof report !== 'object'
    || Array.isArray(report)
    || ![1, 2].includes(report.contractVersion)
    || report.runId !== runId
    || typeof report.targetId !== 'string'
    || !report.targetId
    || !TERMINAL_STATUSES.has(report.status)
    || typeof report.finishedAt !== 'string'
    || Number.isNaN(Date.parse(report.finishedAt))
    || !Array.isArray(cleanup)
    || cleanup.some((entry) => entry?.status !== 'released')
  ) {
    return null;
  }
  return Object.freeze({
    targetId: report.targetId,
    status: report.status,
    finishedAt: new Date(report.finishedAt).toISOString(),
  });
}

export async function inspectQaEvidenceRetention({
  rootDir,
  now = () => Date.now(),
  policy = QA_EVIDENCE_RETENTION_POLICY,
} = {}) {
  if (typeof rootDir !== 'string' || !path.isAbsolute(rootDir)) {
    throw new Error('QA_EVIDENCE_RETENTION_ROOT_ABSOLUTE_REQUIRED');
  }
  const resolvedPolicy = requirePolicy(policy);
  const runRoot = await requireQaEvidenceRoot(rootDir);
  const entries = runRoot === null ? [] : await fs.readdir(runRoot, { withFileTypes: true });
  const terminalRuns = [];
  const protectedRuns = [];
  let totalBytes = 0;
  let totalFileCount = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !RUN_ID_PATTERN.test(entry.name)
      || entry.name === '.' || entry.name === '..') {
      protectedRuns.push(Object.freeze({
        runId: null,
        reasonCode: 'QA_EVIDENCE_RETENTION_RUN_ROOT_INVALID',
      }));
      continue;
    }
    const oneRunRoot = path.join(runRoot, entry.name);
    let measurement;
    try {
      measurement = await measurePlainDirectory(oneRunRoot);
    } catch (error) {
      protectedRuns.push(Object.freeze({
        runId: entry.name,
        reasonCode: error?.message || 'QA_EVIDENCE_RETENTION_RUN_ROOT_UNSAFE',
      }));
      continue;
    }
    totalBytes += measurement.bytes;
    totalFileCount += measurement.fileCount;
    const [runState, cleanupState] = await Promise.all([
      readJson(path.join(oneRunRoot, 'run.json')),
      readJson(path.join(oneRunRoot, 'cleanup.json')),
    ]);
    const terminal = inspectTerminalEvidence(entry.name, runState, cleanupState);
    if (!terminal) {
      protectedRuns.push(Object.freeze({
        runId: entry.name,
        reasonCode: 'QA_EVIDENCE_RETENTION_TERMINAL_EVIDENCE_REQUIRED',
        ...measurement,
      }));
      continue;
    }
    const pin = await readJson(path.join(oneRunRoot, 'retention-pin.json'));
    const journal = await readJson(path.join(oneRunRoot, 'recovery-journal.json'));
    if (pin.status !== 'missing' || (journal.status !== 'missing'
      && (journal.status !== 'valid' || journal.value.state !== 'terminal'))) {
      protectedRuns.push(Object.freeze({ runId: entry.name, ...measurement,
        reasonCode: pin.status !== 'missing' ? 'QA_EVIDENCE_RETENTION_PINNED'
          : 'QA_EVIDENCE_RETENTION_JOURNAL_UNRESOLVED' }));
      continue;
    }
    terminalRuns.push(Object.freeze({
      runId: entry.name,
      ...terminal,
      ...measurement,
    }));
  }

  const keepRunIds = new Set();
  const byTarget = new Map();
  for (const run of terminalRuns) {
    const runs = byTarget.get(run.targetId) || [];
    runs.push(run);
    byTarget.set(run.targetId, runs);
  }
  for (const runs of byTarget.values()) {
    runs.sort((left, right) => (
      right.finishedAt.localeCompare(left.finishedAt)
      || right.runId.localeCompare(left.runId)
    ));
    runs.slice(0, resolvedPolicy.keepPerTarget).forEach((run) => {
      keepRunIds.add(run.runId);
    });
  }

  const nowMs = Number(now());
  if (!Number.isFinite(nowMs)) throw new Error('QA_EVIDENCE_RETENTION_TIME_INVALID');
  const minimumAgeMs = resolvedPolicy.maxAgeDays * 24 * 60 * 60 * 1000;
  const graceMs = resolvedPolicy.minAgeHours * 60 * 60 * 1000;
  const byAge = [...terminalRuns].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const candidates = [];
  let remainingBytes = totalBytes;
  for (const run of byAge) {
    const ageMs = nowMs - Date.parse(run.finishedAt);
    if (ageMs < graceMs) continue;
    const reasonCode = ageMs >= minimumAgeMs ? 'QA_EVIDENCE_RETENTION_EXPIRED'
      : !keepRunIds.has(run.runId) ? 'QA_EVIDENCE_RETENTION_SURPLUS'
        : remainingBytes > resolvedPolicy.maxBytes ? 'QA_EVIDENCE_RETENTION_BUDGET' : null;
    if (reasonCode) {
      candidates.push(Object.freeze({ ...run, reasonCode }));
      remainingBytes -= run.bytes;
    }
  }

  return Object.freeze({
    contractVersion: 1,
    status: protectedRuns.some((run) => !Object.hasOwn(run, 'bytes')) ? 'ATTENTION'
      : totalBytes > resolvedPolicy.maxBytes ? 'BUDGET_EXCEEDED' : 'READY',
    dryRun: true,
    mutationAllowed: false,
    policy: resolvedPolicy,
    totals: Object.freeze({
      runCount: entries.length,
      terminalRunCount: terminalRuns.length,
      protectedRunCount: protectedRuns.length,
      candidateRunCount: candidates.length,
      bytes: totalBytes,
      fileCount: totalFileCount,
      candidateBytes: candidates.reduce((sum, run) => sum + run.bytes, 0),
      projectedBytes: remainingBytes,
      budgetBytes: resolvedPolicy.maxBytes,
    }),
    candidates: Object.freeze(candidates),
    protectedRuns: Object.freeze(protectedRuns),
  });
}
