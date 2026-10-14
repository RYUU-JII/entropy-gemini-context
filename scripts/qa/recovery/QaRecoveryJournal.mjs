import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readWindowsQaProcessStartToken, validateWindowsChildJobIdentity, validateWindowsChildJobReceipt, windowsChildCleanupState } from '../runtime/qaWindowsChildJob.mjs';
import { writeQaJsonAtomic } from '../evidence/qaAtomicJson.mjs';

import {
  readLinuxProcessStartToken,
} from '../../browser-qa/browser/linuxProcessIdentity.mjs';

const JOURNAL_CONTRACT_VERSION = 1;
const RUN_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,159})$/u;
const TARGET_ID_PATTERN = /^[a-z0-9_-]{1,128}$/iu;
const PURPOSE_PATTERN = /^[a-z][a-z0-9_]{2,63}$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export const QA_RECOVERY_TARGET_MARKER_PROPERTY =
  '__entropyQaRecoveryTargetNonceV1';

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function requireRunId(value) {
  if (typeof value !== 'string' || !RUN_ID_PATTERN.test(value)) {
    fail('QA_RECOVERY_JOURNAL_RUN_ID_INVALID');
  }
  return value;
}

function requireAbsolutePath(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail(code);
  return path.normalize(value);
}

function requireIdentifier(value, pattern, code) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code);
  return value;
}

function freezeClone(value) {
  return Object.freeze(structuredClone(value));
}

async function writeJsonAtomic(filePath, value) {
  await writeQaJsonAtomic(filePath, value);
  await fs.chmod(filePath, 0o600);
}

export async function readQaProcessStartToken(pid, {
  procRoot = '/proc',
  readFile = fs.readFile,
} = {}) {
  if (process.platform === 'win32') return readWindowsQaProcessStartToken(pid);
  return readLinuxProcessStartToken(pid, { procRoot, readFile });
}

export async function inspectQaRunnerIdentity(runner, {
  isPidAlive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error?.code === 'EPERM';
    }
  },
  readProcessStartToken = readQaProcessStartToken,
} = {}) {
  if (
    !runner
    || !Number.isSafeInteger(runner.pid)
    || runner.pid < 1
    || (runner.processStartToken !== null
      && typeof runner.processStartToken !== 'string')
  ) {
    fail('QA_RECOVERY_RUNNER_IDENTITY_INVALID');
  }
  if (!isPidAlive(runner.pid)) {
    return Object.freeze({ status: 'absent', proof: 'pid_absent' });
  }
  const currentStartToken = await readProcessStartToken(runner.pid);
  if (
    runner.processStartToken !== null
    && currentStartToken !== null
    && currentStartToken !== runner.processStartToken
  ) {
    return Object.freeze({
      status: 'absent',
      proof: 'pid_reused_with_different_start_token',
    });
  }
  return Object.freeze({
    status: 'active',
    proof: runner.processStartToken !== null && currentStartToken !== null
      ? 'pid_and_start_token_match'
      : 'pid_alive_conservative',
  });
}

function projectPlan(plan) {
  const environment = plan.environment;
  return Object.freeze({
    targetId: plan.targetId,
    mode: plan.mode,
    lane: plan.lane,
    environmentId: environment?.id || null,
    browserClass: environment?.browserClass || null,
    processOwnership: environment?.processOwnership || null,
    profileSlotId: environment?.profileSlotId || null,
    configPath: typeof plan.configPath === 'string'
      ? path.normalize(plan.configPath)
      : null,
    environment: environment ? freezeClone(environment) : null,
  });
}

function requireJournalActive(snapshot) {
  if (snapshot.state !== 'active') {
    fail('QA_RECOVERY_JOURNAL_NOT_ACTIVE', snapshot.state);
  }
}

function findTarget(snapshot, reservationId) {
  const target = snapshot.targets.find((entry) => (
    entry.reservationId === reservationId
  ));
  if (!target) fail('QA_RECOVERY_TARGET_RESERVATION_UNKNOWN');
  return target;
}

export class QaRecoveryJournal {
  constructor(plan, {
    now = () => Date.now(),
    pid = process.pid,
    processStartTokenReader = readQaProcessStartToken,
  } = {}) {
    this.plan = plan;
    this.runId = requireRunId(plan?.runId);
    this.runRoot = requireAbsolutePath(
      plan?.runRoot,
      'QA_RECOVERY_JOURNAL_RUN_ROOT_ABSOLUTE_REQUIRED',
    );
    this.filePath = path.join(this.runRoot, 'recovery-journal.json');
    this.now = now;
    this.pid = pid;
    this.processStartTokenReader = processStartTokenReader;
    this.snapshot = null;
    this.writeQueue = Promise.resolve();
  }

  timestamp() {
    const value = new Date(this.now()).toISOString();
    if (!ISO_DATE_PATTERN.test(value)) fail('QA_RECOVERY_JOURNAL_TIME_INVALID');
    return value;
  }

  async persist() {
    const value = freezeClone(this.snapshot);
    const writeOperation = this.writeQueue.then(() => writeJsonAtomic(this.filePath, value));
    // Each caller keeps its own failed write. The sequencing barrier settles so
    // later exact cleanup facts can be persisted without rolling back physical
    // actions that already happened before the original journal mutation.
    this.writeQueue = writeOperation.then(() => undefined, (error) => {
      console.error(JSON.stringify({ event: 'QA_RECOVERY_JOURNAL_WRITE_FAILED',
        runId: this.runId, code: typeof error?.code === 'string' ? error.code : null }));
    });
    await writeOperation;
    return value;
  }

  async start() {
    if (this.snapshot !== null) fail('QA_RECOVERY_JOURNAL_ALREADY_STARTED');
    await fs.mkdir(this.runRoot, { recursive: true });
    const processStartToken = await this.processStartTokenReader(this.pid);
    const at = this.timestamp();
    this.snapshot = {
      contractVersion: JOURNAL_CONTRACT_VERSION,
      runId: this.runId,
      sessionToken: randomUUID(),
      state: 'active',
      createdAt: at,
      updatedAt: at,
      runner: {
        pid: this.pid,
        processStartToken,
      },
      plan: projectPlan(this.plan),
      browser: null,
      ownedProcess: null,
      childJobs: [],
      resourceClaims: [],
      targets: [],
      recovery: null,
    };
    await this.persist();
    return this.readSnapshot();
  }

  readSnapshot() {
    if (!this.snapshot) fail('QA_RECOVERY_JOURNAL_NOT_STARTED');
    return freezeClone(this.snapshot);
  }

  async mutate(operation) {
    if (!this.snapshot) fail('QA_RECOVERY_JOURNAL_NOT_STARTED');
    requireJournalActive(this.snapshot);
    operation(this.snapshot);
    this.snapshot.updatedAt = this.timestamp();
    return this.persist();
  }

  async recordBrowser(browser) {
    return this.mutate((snapshot) => {
      if (
        !browser
        || typeof browser.browserEpoch !== 'string'
        || !browser.browserEpoch
        || browser.browserEpoch !== browser.browserEpoch.trim()
        || !['attach_only', 'owned'].includes(browser.processOwnership)
      ) {
        fail('QA_RECOVERY_BROWSER_IDENTITY_INVALID');
      }
      if (
        snapshot.plan.processOwnership !== null
        && snapshot.plan.processOwnership !== browser.processOwnership
      ) {
        fail('QA_RECOVERY_BROWSER_OWNERSHIP_MISMATCH');
      }
      snapshot.browser = freezeClone(browser);
    });
  }

  async recordOwnedProcess(identity) {
    return this.mutate((snapshot) => {
      if (
        snapshot.plan.processOwnership !== 'owned'
        || !identity
        || !['linux', 'windows_via_wsl', 'windows'].includes(identity.platform)
        || typeof identity.ownerToken !== 'string'
        || !/^[a-f0-9]{32}$/u.test(identity.ownerToken)
        || !Number.isSafeInteger(identity.remoteDebuggingPort)
        || (
          identity.platform === 'linux'
          && (
            !Number.isSafeInteger(identity.pid)
            || identity.pid < 1
            || typeof identity.processStartToken !== 'string'
            || !/^linux-proc:\d+$/u.test(identity.processStartToken)
          )
        )
      ) {
        fail('QA_RECOVERY_OWNED_PROCESS_IDENTITY_INVALID');
      }
      snapshot.ownedProcess = freezeClone(identity);
    });
  }

  async reserveChildJob({ jobToken, command, requiresCooperativeCleanup }) {
    return this.mutate((snapshot) => {
      if (!/^[a-f0-9-]{36}$/u.test(jobToken || '') || !path.isAbsolute(command) || typeof requiresCooperativeCleanup !== 'boolean'
        || snapshot.childJobs.some((entry) => entry.jobToken === jobToken)) {
        fail('QA_RECOVERY_CHILD_JOB_RESERVATION_INVALID');
      }
      snapshot.childJobs.push({ jobToken, command, requiresCooperativeCleanup, state: 'reserved', identity: null, receipt: null });
    });
  }

  async admitChildJob(identity) {
    return this.mutate((snapshot) => {
      const entry = snapshot.childJobs.find((job) => job.jobToken === identity.jobToken);
      if (!entry || entry.state !== 'reserved' || !Number.isSafeInteger(identity.pid)
        || !/^windows-filetime:\d+$/u.test(identity.processStartToken || '')) {
        fail('QA_RECOVERY_CHILD_JOB_IDENTITY_INVALID');
      }
      validateWindowsChildJobIdentity(identity, entry);
      entry.identity = freezeClone(identity);
      entry.state = 'admitted';
    });
  }

  async releaseChildJob({ jobToken, receipt }) {
    return this.mutate((snapshot) => {
      const entry = snapshot.childJobs.find((job) => job.jobToken === jobToken);
      if (!entry || entry.state !== 'admitted' || receipt.jobToken !== jobToken
        || receipt.activeProcessCount !== 0 || receipt.proof !== 'windows_job_active_process_zero') {
        fail('QA_RECOVERY_CHILD_JOB_RELEASE_INVALID');
      }
      validateWindowsChildJobReceipt(receipt, jobToken);
      entry.receipt = freezeClone(receipt);
      entry.state = windowsChildCleanupState(receipt, entry.requiresCooperativeCleanup);
    });
  }

  async recordResourceClaimAcquired(record) {
    return this.mutate((snapshot) => {
      if (
        !record
        || typeof record.resourceKey !== 'string'
        || !record.resourceKey.trim()
        || typeof record.token !== 'string'
        || !record.token
        || record.runId !== this.runId
        || record.pid !== this.pid
        || typeof record.lockPath !== 'string'
        || !path.isAbsolute(record.lockPath)
      ) {
        fail('QA_RECOVERY_RESOURCE_CLAIM_INVALID');
      }
      if (snapshot.resourceClaims.some((entry) => (
        entry.resourceKey === record.resourceKey && entry.state === 'acquired'
      ))) {
        fail('QA_RECOVERY_RESOURCE_CLAIM_DUPLICATE', record.resourceKey);
      }
      snapshot.resourceClaims.push({
        ...record,
        state: 'acquired',
        acquiredAt: this.timestamp(),
        releasedAt: null,
      });
    });
  }

  async recordResourceClaimReleased({ resourceKey, token } = {}) {
    return this.mutate((snapshot) => {
      const claim = snapshot.resourceClaims.find((entry) => (
        entry.resourceKey === resourceKey
        && entry.token === token
        && ['acquired', 'released'].includes(entry.state)
      ));
      if (!claim) fail('QA_RECOVERY_RESOURCE_CLAIM_NOT_OWNED', resourceKey || 'missing');
      if (claim.state === 'acquired') {
        claim.state = 'released';
        claim.releasedAt = this.timestamp();
      }
    });
  }

  async reserveTarget({ browserEpoch, purpose, initialUrl = null } = {}) {
    const normalizedPurpose = requireIdentifier(
      purpose,
      PURPOSE_PATTERN,
      'QA_RECOVERY_TARGET_PURPOSE_INVALID',
    );
    if (
      typeof browserEpoch !== 'string'
      || !browserEpoch
      || browserEpoch !== browserEpoch.trim()
    ) {
      fail('QA_RECOVERY_TARGET_BROWSER_EPOCH_INVALID');
    }
    if (initialUrl !== null && (typeof initialUrl !== 'string' || !initialUrl.trim())) {
      fail('QA_RECOVERY_TARGET_INITIAL_URL_INVALID');
    }
    const reservation = Object.freeze({
      reservationId: randomUUID(),
      targetNonce: randomUUID(),
      markerProperty: QA_RECOVERY_TARGET_MARKER_PROPERTY,
      browserEpoch,
      purpose: normalizedPurpose,
      initialUrl,
    });
    await this.mutate((snapshot) => {
      if (
        snapshot.browser
        && snapshot.browser.browserEpoch !== reservation.browserEpoch
      ) {
        fail('QA_RECOVERY_TARGET_BROWSER_EPOCH_MISMATCH');
      }
      snapshot.targets.push({
        ...reservation,
        targetId: null,
        tabId: null,
        proofKind: null,
        state: 'reserved',
        reservedAt: this.timestamp(),
        admittedAt: null,
        releasedAt: null,
        releaseStatus: null,
      });
    });
    return reservation;
  }

  async admitTarget({
    reservationId,
    targetId,
    tabId = null,
    proofKind,
    initialUrl = null,
  } = {}) {
    requireIdentifier(
      targetId,
      TARGET_ID_PATTERN,
      'QA_RECOVERY_TARGET_ID_INVALID',
    );
    if (!['runtime_marker', 'exact_initial_url'].includes(proofKind)) {
      fail('QA_RECOVERY_TARGET_PROOF_INVALID');
    }
    if (tabId !== null && (!Number.isSafeInteger(tabId) || tabId < 0)) {
      fail('QA_RECOVERY_TARGET_TAB_ID_INVALID');
    }
    return this.mutate((snapshot) => {
      const target = findTarget(snapshot, reservationId);
      if (target.state !== 'reserved') {
        fail('QA_RECOVERY_TARGET_RESERVATION_STATE_INVALID', target.state);
      }
      if (snapshot.targets.some((entry) => (
        entry !== target && entry.targetId === targetId && entry.state === 'admitted'
      ))) {
        fail('QA_RECOVERY_TARGET_ID_DUPLICATE', targetId);
      }
      target.targetId = targetId;
      target.tabId = tabId;
      target.proofKind = proofKind;
      target.initialUrl = initialUrl ?? target.initialUrl;
      target.state = 'admitted';
      target.admittedAt = this.timestamp();
    });
  }

  async releaseTarget({ targetId, status } = {}) {
    if (!['closed', 'already_absent'].includes(status)) {
      fail('QA_RECOVERY_TARGET_RELEASE_STATUS_INVALID');
    }
    return this.mutate((snapshot) => {
      const target = snapshot.targets.find((entry) => (
        entry.targetId === targetId && entry.state === 'admitted'
      ));
      if (!target) fail('QA_RECOVERY_TARGET_NOT_OWNED', targetId || 'missing');
      target.state = 'released';
      target.releaseStatus = status;
      target.releasedAt = this.timestamp();
    });
  }

  async finalize({ status, cleanupComplete } = {}) {
    if (!this.snapshot) fail('QA_RECOVERY_JOURNAL_NOT_STARTED');
    requireJournalActive(this.snapshot);
    if (typeof status !== 'string' || !status.trim()) {
      fail('QA_RECOVERY_JOURNAL_FINAL_STATUS_INVALID');
    }
    if (typeof cleanupComplete !== 'boolean') {
      fail('QA_RECOVERY_JOURNAL_CLEANUP_STATE_INVALID');
    }
    this.snapshot.state = cleanupComplete ? 'terminal' : 'active';
    this.snapshot.terminalStatus = status;
    this.snapshot.cleanupComplete = cleanupComplete;
    this.snapshot.finishedAt = this.timestamp();
    this.snapshot.updatedAt = this.snapshot.finishedAt;
    await this.persist();
    return this.readSnapshot();
  }
}

export function resolveQaRecoveryJournalPath({ rootDir, runId } = {}) {
  const canonicalRoot = requireAbsolutePath(
    rootDir,
    'QA_RECOVERY_ROOT_ABSOLUTE_REQUIRED',
  );
  const canonicalRunId = requireRunId(runId);
  return path.join(
    canonicalRoot,
    '.artifacts',
    'qa',
    'runs',
    canonicalRunId,
    'recovery-journal.json',
  );
}

function validateStoredJournal(snapshot, expectedRunId) {
  if (
    !snapshot
    || typeof snapshot !== 'object'
    || Array.isArray(snapshot)
    || snapshot.contractVersion !== JOURNAL_CONTRACT_VERSION
    || snapshot.runId !== expectedRunId
    || typeof snapshot.sessionToken !== 'string'
    || !/^[a-f0-9-]{36}$/u.test(snapshot.sessionToken)
    || !['active', 'terminal', 'recovered'].includes(snapshot.state)
    || !snapshot.runner
    || !Number.isSafeInteger(snapshot.runner.pid)
    || snapshot.runner.pid < 1
    || (snapshot.runner.processStartToken !== null
      && typeof snapshot.runner.processStartToken !== 'string')
    || !snapshot.plan
    || typeof snapshot.plan.targetId !== 'string'
    || !['attach_only', 'owned', null].includes(snapshot.plan.processOwnership)
    || !Array.isArray(snapshot.resourceClaims)
    || !Array.isArray(snapshot.targets)
    || (snapshot.state === 'recovered'
      && (
        snapshot.recovery?.status !== 'RECOVERED'
        || snapshot.recovery?.runId !== expectedRunId
      ))
  ) {
    fail('QA_RECOVERY_JOURNAL_CONTRACT_INVALID', expectedRunId);
  }
  for (const claim of snapshot.resourceClaims) {
    if (
      !claim
      || typeof claim.resourceKey !== 'string'
      || claim.runId !== expectedRunId
      || typeof claim.token !== 'string'
      || !claim.token
      || !Number.isSafeInteger(claim.pid)
      || typeof claim.lockPath !== 'string'
      || !path.isAbsolute(claim.lockPath)
      || !['acquired', 'released', 'recovered'].includes(claim.state)
    ) {
      fail('QA_RECOVERY_JOURNAL_RESOURCE_CONTRACT_INVALID');
    }
  }
  for (const target of snapshot.targets) {
    if (
      !target
      || typeof target.reservationId !== 'string'
      || typeof target.targetNonce !== 'string'
      || target.markerProperty !== QA_RECOVERY_TARGET_MARKER_PROPERTY
      || typeof target.browserEpoch !== 'string'
      || !PURPOSE_PATTERN.test(target.purpose || '')
      || !['reserved', 'admitted', 'released', 'recovered'].includes(target.state)
      || (target.targetId !== null && !TARGET_ID_PATTERN.test(target.targetId || ''))
      || (target.state === 'admitted'
        && !['runtime_marker', 'exact_initial_url'].includes(target.proofKind))
    ) {
      fail('QA_RECOVERY_JOURNAL_TARGET_CONTRACT_INVALID');
    }
  }
  // Additive v1 capability: omission means no Windows Job was registered by
  // that writer. It is never evidence of cleanup for an unverified child.
  if (Object.hasOwn(snapshot, 'childJobs')) {
    if (!Array.isArray(snapshot.childJobs)) fail('QA_RECOVERY_CHILD_JOBS_INVALID');
    const tokens = new Set();
    for (const job of snapshot.childJobs) {
      if (!job || !/^[a-f0-9-]{36}$/u.test(job.jobToken || '') || tokens.has(job.jobToken)
        || !path.isAbsolute(job.command || '') || typeof job.requiresCooperativeCleanup !== 'boolean'
        || !['reserved', 'admitted', 'released', 'recovered', 'unverified_targets', 'cleanup_failed'].includes(job.state)
        || (job.state === 'admitted' && (!job.identity || job.identity.jobToken !== job.jobToken))) {
        fail('QA_RECOVERY_CHILD_JOB_CONTRACT_INVALID');
      }
      tokens.add(job.jobToken);
      if (['admitted', 'released', 'unverified_targets', 'cleanup_failed'].includes(job.state) && !job.identity) {
        fail('QA_RECOVERY_CHILD_JOB_IDENTITY_REQUIRED');
      }
      if (['released', 'unverified_targets', 'cleanup_failed'].includes(job.state)
        && (!job.receipt || windowsChildCleanupState(job.receipt, job.requiresCooperativeCleanup) !== job.state)) {
        fail('QA_RECOVERY_CHILD_JOB_RECEIPT_REQUIRED');
      }
      if (job.identity !== null) validateWindowsChildJobIdentity(job.identity, job);
      if (job.receipt !== null) validateWindowsChildJobReceipt(job.receipt, job.jobToken);
    }
  }
  return freezeClone(snapshot);
}

export async function readQaRecoveryJournal({ rootDir, runId } = {}) {
  const filePath = resolveQaRecoveryJournalPath({ rootDir, runId });
  const stat = await fs.lstat(filePath).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) {
    fail('QA_RECOVERY_JOURNAL_FILE_INVALID');
  }
  let snapshot;
  try {
    snapshot = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error('QA_RECOVERY_JOURNAL_JSON_INVALID', { cause: error });
  }
  return validateStoredJournal(snapshot, requireRunId(runId));
}

export async function completeQaRecoveryJournal({
  rootDir,
  runId,
  expectedSessionToken,
  targetOutcomes = [],
  resourceOutcomes = [],
  processOutcome = null,
  childJobOutcomes = [],
  now = () => Date.now(),
} = {}) {
  const current = await readQaRecoveryJournal({ rootDir, runId });
  if (!current || current.state !== 'active') {
    fail('QA_RECOVERY_JOURNAL_NOT_RECOVERABLE', current?.state || 'missing');
  }
  if (current.sessionToken !== expectedSessionToken) {
    fail('QA_RECOVERY_JOURNAL_SESSION_CHANGED');
  }
  const recoveredAt = new Date(now()).toISOString();
  const snapshot = structuredClone(current);
  for (const outcome of childJobOutcomes) {
    const job = snapshot.childJobs?.find((entry) => entry.jobToken === outcome.jobToken);
    if (!job || !['reserved', 'admitted'].includes(job.state) || outcome.status !== 'already_absent') {
      fail('QA_RECOVERY_CHILD_JOB_OUTCOME_INVALID');
    }
    job.state = 'recovered';
  }
  if (snapshot.childJobs?.some((job) => !['released', 'recovered'].includes(job.state))) {
    fail('QA_RECOVERY_CHILD_JOBS_REMAIN');
  }
  for (const outcome of targetOutcomes) {
    const target = snapshot.targets.find((entry) => (
      entry.targetId === outcome.targetId && entry.state === 'admitted'
    ));
    if (!target || !['closed', 'already_absent'].includes(outcome.status)) {
      fail('QA_RECOVERY_TARGET_OUTCOME_INVALID');
    }
    target.state = 'recovered';
    target.releaseStatus = outcome.status;
    target.releasedAt = recoveredAt;
  }
  for (const outcome of resourceOutcomes) {
    const claim = snapshot.resourceClaims.find((entry) => (
      entry.resourceKey === outcome.resourceKey
      && entry.token === outcome.token
      && entry.state === 'acquired'
    ));
    if (!claim || !['released', 'already_absent'].includes(outcome.status)) {
      fail('QA_RECOVERY_RESOURCE_OUTCOME_INVALID');
    }
    claim.state = 'recovered';
    claim.releasedAt = recoveredAt;
  }
  if (snapshot.targets.some((target) => target.state === 'admitted')) {
    fail('QA_RECOVERY_TARGETS_REMAIN');
  }
  if (snapshot.targets.some((target) => target.state === 'reserved')) {
    fail('QA_RECOVERY_RESERVED_TARGET_PROOF_REQUIRED');
  }
  if (snapshot.resourceClaims.some((claim) => claim.state === 'acquired')) {
    fail('QA_RECOVERY_RESOURCE_CLAIMS_REMAIN');
  }
  const recovery = Object.freeze({
    contractVersion: 1,
    runId,
    status: 'RECOVERED',
    recoveredAt,
    runnerProof: 'original_runner_absent',
    process: processOutcome,
    childJobs: freezeClone(childJobOutcomes),
    targets: freezeClone(targetOutcomes),
    resourceClaims: freezeClone(resourceOutcomes),
  });
  snapshot.state = 'recovered';
  snapshot.recovery = recovery;
  snapshot.updatedAt = recoveredAt;
  const journalPath = resolveQaRecoveryJournalPath({ rootDir, runId });
  await writeJsonAtomic(journalPath, snapshot);
  await writeJsonAtomic(path.join(path.dirname(journalPath), 'recovery.json'), recovery);
  return recovery;
}
