import fs from 'node:fs/promises';
import path from 'node:path';

import {
  inspectQaRunnerIdentity,
  readQaRecoveryJournal,
} from './QaRecoveryJournal.mjs';

const RUN_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,159})$/u;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const TERMINAL_STATUSES = new Set([
  'PASS',
  'FAIL',
  'BLOCKED',
  'INCONCLUSIVE',
  'READY_FOR_HUMAN',
]);

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isPathInside(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

async function readJsonState(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return Object.freeze({ status: 'missing' });
    return Object.freeze({
      status: 'invalid',
      reasonCode: 'QA_RECOVERY_EVIDENCE_READ_FAILED',
    });
  }
  try {
    return Object.freeze({ status: 'valid', value: JSON.parse(raw) });
  } catch {
    return Object.freeze({
      status: 'invalid',
      reasonCode: 'QA_RECOVERY_EVIDENCE_JSON_INVALID',
    });
  }
}

async function readResourceLockCounts(lockRoot) {
  const entries = await fs.readdir(lockRoot, { withFileTypes: true })
    .catch((error) => {
      if (error?.code === 'ENOENT') return [];
      throw error;
    });
  const runCounts = new Map();
  let invalidLockCount = 0;
  for (const entry of entries) {
    if (!entry.name.endsWith('.lock')) continue;
    if (!entry.isFile()) {
      invalidLockCount += 1;
      continue;
    }
    const state = await readJsonState(path.join(lockRoot, entry.name));
    const runId = state.status === 'valid'
      && typeof state.value?.runId === 'string'
      && RUN_ID_PATTERN.test(state.value.runId)
      ? state.value.runId
      : null;
    if (!runId) {
      invalidLockCount += 1;
      continue;
    }
    runCounts.set(runId, (runCounts.get(runId) || 0) + 1);
  }
  return Object.freeze({ runCounts, invalidLockCount });
}

function classifyIncompleteRun(runState, cleanupState) {
  if (runState.status === 'invalid') {
    return Object.freeze({
      state: 'terminal_report_invalid',
      reasonCode: runState.reasonCode,
    });
  }
  if (runState.status === 'valid' && cleanupState.status === 'missing') {
    return Object.freeze({
      state: 'cleanup_report_missing',
      reasonCode: 'QA_RECOVERY_CLEANUP_REPORT_MISSING',
    });
  }
  if (runState.status === 'valid' && cleanupState.status === 'invalid') {
    return Object.freeze({
      state: 'cleanup_report_invalid',
      reasonCode: cleanupState.reasonCode,
    });
  }
  if (runState.status === 'valid') return null;
  if (cleanupState.status === 'invalid') {
    return Object.freeze({
      state: 'cleanup_report_invalid',
      reasonCode: cleanupState.reasonCode,
    });
  }
  if (cleanupState.status === 'valid') {
    const cleanup = cleanupState.value;
    const cleanupComplete = Array.isArray(cleanup)
      && cleanup.every((entry) => entry?.status === 'released');
    return Object.freeze({
      state: cleanupComplete
        ? 'terminal_report_missing'
        : 'cleanup_incomplete',
      reasonCode: cleanupComplete
        ? 'QA_RECOVERY_TERMINAL_REPORT_MISSING'
        : 'QA_RECOVERY_CLEANUP_INCOMPLETE',
    });
  }
  return Object.freeze({
    state: 'nonterminal_or_abandoned',
    reasonCode: 'QA_RECOVERY_TERMINAL_AND_CLEANUP_MISSING',
  });
}

function readTerminalIdentity(runState) {
  const report = runState.status === 'valid' ? runState.value : null;
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  if (
    ![1, 2].includes(report.contractVersion)
    || typeof report.runId !== 'string'
    || typeof report.targetId !== 'string'
    || typeof report.status !== 'string'
  ) return null;
  return Object.freeze({
    contractVersion: report.contractVersion,
    runId: report.runId,
    targetId: report.targetId,
    status: report.status,
  });
}

function projectHistoricalTerminalJournal(value, expectedRunId, rootDir) {
  const lockRoot = path.join(rootDir, '.artifacts', 'qa', 'locks');
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.contractVersion !== 2
    || value.runId !== expectedRunId
    || typeof value.sessionToken !== 'string'
    || !UUID_PATTERN.test(value.sessionToken)
    || value.state !== 'terminal'
    || value.cleanupComplete !== true
    || !TERMINAL_STATUSES.has(value.terminalStatus)
    || !isCanonicalIsoTimestamp(value.finishedAt)
    || !value.runner
    || !Number.isSafeInteger(value.runner.pid)
    || value.runner.pid < 1
    || typeof value.runner.processStartToken !== 'string'
    || !value.runner.processStartToken
    || !value.plan
    || typeof value.plan.targetId !== 'string'
    || !value.plan.targetId
    || value.plan.browserClass !== 'ephemeral_extension'
    || value.plan.processOwnership !== 'owned'
    || value.browser !== null
    || value.ownedProcess !== null
    || value.recovery !== null
    || !Array.isArray(value.resourceClaims)
    || !Array.isArray(value.targets)
    || value.targets.length !== 0
    || value.resourceClaims.some((claim) => (
      !claim
      || claim.contractVersion !== 1
      || claim.runId !== expectedRunId
      || typeof claim.resourceKey !== 'string'
      || !claim.resourceKey
      || typeof claim.token !== 'string'
      || !UUID_PATTERN.test(claim.token)
      || !Number.isSafeInteger(claim.pid)
      || claim.pid < 1
      || typeof claim.lockPath !== 'string'
      || !path.isAbsolute(claim.lockPath)
      || !claim.lockPath.endsWith('.lock')
      || !isPathInside(lockRoot, claim.lockPath)
      || claim.state !== 'released'
    ))
  ) {
    return null;
  }
  return Object.freeze({
    contractVersion: 2,
    runId: expectedRunId,
    state: 'terminal',
    targetId: value.plan.targetId,
    terminalStatus: value.terminalStatus,
    cleanupComplete: true,
    observationOnly: true,
    mutationCompatible: false,
  });
}

async function inspectJournalState({ rootDir, runId, runRoot }) {
  try {
    const value = await readQaRecoveryJournal({ rootDir, runId });
    return Object.freeze({
      status: value ? 'valid' : 'missing',
      value,
    });
  } catch {
    const raw = await readJsonState(path.join(runRoot, 'recovery-journal.json'));
    if (raw.status === 'valid') {
      const historical = projectHistoricalTerminalJournal(raw.value, runId, rootDir);
      if (historical) {
        return Object.freeze({
          status: 'historical_terminal',
          value: historical,
        });
      }
    }
    return Object.freeze({
      status: 'invalid',
      reasonCode: 'QA_RECOVERY_JOURNAL_INVALID',
    });
  }
}

function projectRecoveryHealth(journal, runner, nowMs) {
  const createdAt = isCanonicalIsoTimestamp(journal?.createdAt) ? journal.createdAt : null;
  const ageMs = createdAt === null ? null : Math.max(0, nowMs - Date.parse(createdAt));
  let recoveryBlockerCode = null;
  if (journal?.state === 'active') {
    if (!Object.hasOwn(journal, 'childJobs')) recoveryBlockerCode = 'QA_RECOVERY_CHILD_JOB_CAPABILITY_REQUIRED';
    else if (journal.childJobs.some((job) => job.state === 'cleanup_failed')) recoveryBlockerCode = 'QA_RECOVERY_CHILD_CLEANUP_PROOF_REQUIRED';
    else if (journal.childJobs.some((job) => job.state === 'unverified_targets'
      || (job.requiresCooperativeCleanup && job.state === 'admitted'))) recoveryBlockerCode = 'QA_RECOVERY_CHILD_TARGET_PROOF_REQUIRED';
    else if (journal.targets.some((target) => target.state === 'reserved')) recoveryBlockerCode = 'QA_RECOVERY_RESERVED_TARGET_PROOF_REQUIRED';
    else if (journal.plan.processOwnership === 'owned' && journal.ownedProcess === null
      && journal.browser === null && journal.targets.some((target) => target.state === 'admitted')) recoveryBlockerCode = 'QA_RECOVERY_OWNED_PROCESS_IDENTITY_REQUIRED';
  }
  return {
    createdAt,
    ageMs,
    stale: runner?.status === 'absent' && ageMs !== null && ageMs >= STALE_AFTER_MS,
    recoveryBlockerCode,
    pendingTargetCount: Array.isArray(journal?.targets)
      ? journal.targets.filter((target) => ['reserved', 'admitted'].includes(target.state)).length : null,
    pendingChildJobCount: Array.isArray(journal?.childJobs)
      ? journal.childJobs.filter((job) => !['released', 'recovered'].includes(job.state)).length : null,
    processProofRequired: journal?.plan?.processOwnership === 'owned' && journal.browser !== null && journal.ownedProcess === null,
  };
}

export async function inspectQaRecoveryState({ rootDir, now = () => Date.now(), runnerInspector = inspectQaRunnerIdentity } = {}) {
  if (typeof rootDir !== 'string' || !path.isAbsolute(rootDir)) {
    throw new Error('QA_RECOVERY_ROOT_ABSOLUTE_REQUIRED');
  }
  const qaRoot = path.join(rootDir, '.artifacts', 'qa');
  const runRoot = path.join(qaRoot, 'runs');
  const entries = await fs.readdir(runRoot, { withFileTypes: true })
    .catch((error) => {
      if (error?.code === 'ENOENT') return [];
      throw error;
    });
  const { runCounts, invalidLockCount } = await readResourceLockCounts(
    path.join(qaRoot, 'locks'),
  );
  const incompleteRuns = [];
  const nowMs = now();
  if (!Number.isFinite(nowMs)) throw new Error('QA_RECOVERY_INSPECTION_TIME_INVALID');
  let terminalRunCount = 0;
  let historicalTerminalRunCount = 0;
  let recoveredRunCount = 0;
  let invalidRunRootCount = 0;
  let manualRecoveryCandidateCount = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !RUN_ID_PATTERN.test(entry.name)) {
      invalidRunRootCount += 1;
      continue;
    }
    const oneRunRoot = path.join(runRoot, entry.name);
    const [runState, cleanupState, journalState] = await Promise.all([
      readJsonState(path.join(oneRunRoot, 'run.json')),
      readJsonState(path.join(oneRunRoot, 'cleanup.json')),
      inspectJournalState({
        rootDir,
        runId: entry.name,
        runRoot: oneRunRoot,
      }),
    ]);
    if (journalState.status === 'valid' && journalState.value?.state === 'recovered') {
      recoveredRunCount += 1;
      continue;
    }
    const incomplete = classifyIncompleteRun(runState, cleanupState);
    if (!incomplete && journalState.status !== 'invalid') {
      const terminal = readTerminalIdentity(runState);
      const terminalJournalMatches = journalState.status === 'historical_terminal'
        ? journalState.value.terminalStatus === terminal?.status
          && journalState.value.targetId === terminal?.targetId
          && (runCounts.get(entry.name) || 0) === 0
        : journalState.value?.state !== 'active';
      if (
        terminal?.runId === entry.name
        && terminalJournalMatches
      ) {
        terminalRunCount += 1;
        if (
          terminal.contractVersion === 1
          || journalState.status === 'historical_terminal'
        ) {
          historicalTerminalRunCount += 1;
        }
      } else {
        const runner = journalState.value?.state === 'active'
          ? await runnerInspector(journalState.value.runner)
          : null;
        const health = projectRecoveryHealth(journalState.value, runner, nowMs);
        const manualRecoveryAllowed = runner?.status === 'absent' && health.recoveryBlockerCode === null;
        if (manualRecoveryAllowed) manualRecoveryCandidateCount += 1;
        incompleteRuns.push(Object.freeze({
          runId: entry.name,
          state: journalState.value?.state === 'active'
            ? 'durable_journal_active'
            : 'terminal_report_contract_invalid',
          reasonCode: journalState.value?.state === 'active'
            ? 'QA_RECOVERY_DURABLE_JOURNAL_ACTIVE'
            : 'QA_RECOVERY_TERMINAL_REPORT_CONTRACT_INVALID',
          resourceClaimLockCount: runCounts.get(entry.name) || 0,
          automaticMutationAllowed: false,
          manualRecoveryAllowed,
          runnerStatus: runner?.status || null,
          ...health,
          nextAction: manualRecoveryAllowed
            ? `npm run qa -- recovery recover ${entry.name}`
            : runner?.status === 'active'
              ? 'wait_for_active_run_to_finish'
              : health.recoveryBlockerCode ? 'inspect_missing_recovery_capability' : 'inspect_exact_process_and_target_identity',
        }));
      }
      continue;
    }
    if (journalState.status === 'invalid') {
      incompleteRuns.push(Object.freeze({
        runId: entry.name,
        state: 'recovery_journal_invalid',
        reasonCode: journalState.reasonCode,
        resourceClaimLockCount: runCounts.get(entry.name) || 0,
        automaticMutationAllowed: false,
        manualRecoveryAllowed: false,
        runnerStatus: null,
        ...projectRecoveryHealth(null, null, nowMs),
        nextAction: 'inspect_recovery_journal_contract',
      }));
      continue;
    }
    const runner = journalState.value?.state === 'active'
      ? await runnerInspector(journalState.value.runner)
      : null;
    const health = projectRecoveryHealth(journalState.value, runner, nowMs);
    const manualRecoveryAllowed = runner?.status === 'absent' && health.recoveryBlockerCode === null;
    if (manualRecoveryAllowed) manualRecoveryCandidateCount += 1;
    incompleteRuns.push(Object.freeze({
      runId: entry.name,
      state: incomplete.state,
      reasonCode: incomplete.reasonCode,
      resourceClaimLockCount: runCounts.get(entry.name) || 0,
      automaticMutationAllowed: false,
      manualRecoveryAllowed,
      runnerStatus: runner?.status || null,
      ...health,
      nextAction: manualRecoveryAllowed
        ? `npm run qa -- recovery recover ${entry.name}`
        : runner?.status === 'active'
          ? 'wait_for_active_run_to_finish'
          : health.recoveryBlockerCode ? 'inspect_missing_recovery_capability' : 'inspect_exact_process_and_target_identity',
    }));
  }
  incompleteRuns.sort((left, right) => left.runId.localeCompare(right.runId));
  const attention = incompleteRuns.length > 0
    || invalidLockCount > 0
    || invalidRunRootCount > 0;
  return Object.freeze({
    contractVersion: 1,
    status: attention ? 'ATTENTION' : 'CLEAN',
    terminalRunCount,
    historicalTerminalRunCount,
    recoveredRunCount,
    incompleteRunCount: incompleteRuns.length,
    invalidRunRootCount,
    invalidResourceLockCount: invalidLockCount,
    manualRecoveryCandidateCount,
    health: Object.freeze({
      generatedAt: new Date(nowMs).toISOString(),
      staleAfterMs: STALE_AFTER_MS,
      activeRunCount: incompleteRuns.filter((run) => run.runnerStatus === 'active').length,
      abandonedRunCount: incompleteRuns.filter((run) => run.runnerStatus === 'absent').length,
      staleAbandonedRunCount: incompleteRuns.filter((run) => run.stale).length,
      unresolvedRunCount: incompleteRuns.filter((run) => !run.manualRecoveryAllowed && run.runnerStatus !== 'active').length,
      processAbsenceProofRequiredCount: incompleteRuns.filter((run) => run.processProofRequired).length,
      oldestAbandonedAgeMs: incompleteRuns.some((run) => run.runnerStatus === 'absent' && run.ageMs !== null)
        ? Math.max(...incompleteRuns.filter((run) => run.runnerStatus === 'absent' && run.ageMs !== null).map((run) => run.ageMs)) : null,
      resourceClaimLockCount: incompleteRuns.reduce((total, run) => total + run.resourceClaimLockCount, 0),
    }),
    incompleteRuns: Object.freeze(incompleteRuns),
    automaticMutationAllowed: false,
  });
}
