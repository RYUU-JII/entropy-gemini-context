import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const QA_ARTIFACT_ADMISSION_WAIT_TIMEOUT_MS = 180_000;
const ARTIFACT_ADMISSION_POLL_MS = 250;

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error('QA_RUN_ABORTED:artifact_admission', { cause: signal.reason });
    error.code = 'QA_RUN_ABORTED';
    throw error;
  }
}

function safeLockName(resourceKey) {
  const prefix = resourceKey
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48) || 'resource';
  const digest = createHash('sha256').update(resourceKey).digest('hex').slice(0, 16);
  return `${prefix}-${digest}.lock`;
}

async function writeExclusiveJson(filePath, value) {
  const handle = await fs.open(filePath, 'wx');
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  } finally {
    await handle.close();
  }
}

export class QaResourceCoordinator {
  constructor({
    lockRoot,
    runId,
    pid = process.pid,
    now = () => Date.now(),
    recoveryJournal = null,
  }) {
    if (!path.isAbsolute(lockRoot || '')) {
      throw new Error('QA_LOCK_ROOT_ABSOLUTE_REQUIRED');
    }
    this.lockRoot = lockRoot;
    this.runId = runId;
    this.pid = pid;
    this.now = now;
    this.recoveryJournal = recoveryJournal;
    this.token = randomUUID();
    this.leases = [];
  }

  async acquireAll(resourceClaims = [], {
    artifactAdmissionClaims = [],
    admissionTimeoutMs = QA_ARTIFACT_ADMISSION_WAIT_TIMEOUT_MS,
    signal = null,
    onAdmissionWait = null,
  } = {}) {
    const claims = [...new Set(resourceClaims)].sort();
    if (!Array.isArray(artifactAdmissionClaims)
      || new Set(artifactAdmissionClaims).size !== artifactAdmissionClaims.length
      || artifactAdmissionClaims.some(claim => claim !== 'artifact:dev_extension' || !claims.includes(claim))
      || !Number.isSafeInteger(admissionTimeoutMs) || admissionTimeoutMs < 1
      || admissionTimeoutMs > QA_ARTIFACT_ADMISSION_WAIT_TIMEOUT_MS
      || (onAdmissionWait !== null && typeof onAdmissionWait !== 'function')) {
      throw new Error('QA_RESOURCE_ARTIFACT_ADMISSION_WAIT_INVALID');
    }
    await fs.mkdir(this.lockRoot, { recursive: true });
    try {
      for (const resourceKey of claims) {
        throwIfAborted(signal);
        if (artifactAdmissionClaims.includes(resourceKey)) {
          await this.#acquireArtifactAdmission(resourceKey, { admissionTimeoutMs, signal, onAdmissionWait });
        } else {
          await this.acquire(resourceKey);
        }
      }
    } catch (error) {
      try {
        await this.releaseAll();
      } catch (rollbackError) {
        const aggregate = new AggregateError(
          [error, rollbackError],
          `QA_RESOURCE_ACQUIRE_ROLLBACK_FAILED:${error?.message || error}`,
          { cause: error },
        );
        aggregate.code = 'QA_RESOURCE_ACQUIRE_ROLLBACK_FAILED';
        throw aggregate;
      }
      throw error;
    }
    return Object.freeze([...this.leases]);
  }

  async #acquireArtifactAdmission(resourceKey, { admissionTimeoutMs, signal, onAdmissionWait }) {
    const startedAt = performance.now();
    let waiting = false;
    let lastBusy = null;
    const notify = async phase => onAdmissionWait?.(Object.freeze({ phase, resourceKey,
      timeoutMs: admissionTimeoutMs, waitedMs: Math.round(performance.now() - startedAt) }));
    try {
      while (true) {
        throwIfAborted(signal);
        if (waiting && performance.now() - startedAt >= admissionTimeoutMs) {
          const error = new Error(`QA_ARTIFACT_ADMISSION_TIMEOUT:${resourceKey}`, { cause: lastBusy });
          error.code = 'QA_ARTIFACT_ADMISSION_TIMEOUT';
          throw error;
        }
        try {
          await this.acquire(resourceKey);
          break;
        } catch (error) {
          if (error.code !== 'QA_RESOURCE_BUSY' || error.resourceKey !== resourceKey) throw error;
          lastBusy = error;
        }
        if (!waiting) {
          waiting = true;
          await notify('WAITING');
        }
        const remainingMs = admissionTimeoutMs - (performance.now() - startedAt);
        if (remainingMs > 0) {
          try {
            await delay(Math.min(ARTIFACT_ADMISSION_POLL_MS, remainingMs), undefined,
              signal === null ? {} : { signal });
          } catch (error) {
            throwIfAborted(signal);
            throw error;
          }
        }
      }
    } catch (error) {
      if (waiting) await notify(error.code === 'QA_RUN_ABORTED' ? 'ABORTED'
        : error.code === 'QA_ARTIFACT_ADMISSION_TIMEOUT' ? 'TIMED_OUT' : 'FAILED');
      throw error;
    }
    if (waiting) await notify('ACQUIRED');
  }

  async acquire(resourceKey) {
    if (typeof resourceKey !== 'string' || !resourceKey.trim()) {
      throw new Error('QA_RESOURCE_KEY_INVALID');
    }
    const lockPath = path.join(this.lockRoot, safeLockName(resourceKey));
    const record = Object.freeze({
      contractVersion: 1,
      resourceKey,
      runId: this.runId,
      token: this.token,
      pid: this.pid,
      acquiredAt: new Date(this.now()).toISOString(),
    });
    try {
      await writeExclusiveJson(lockPath, record);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const owner = await fs.readFile(lockPath, 'utf8').catch(() => '');
      const busy = new Error(`QA_RESOURCE_BUSY:${resourceKey}:${owner.trim() || 'owner_unavailable'}`);
      busy.code = 'QA_RESOURCE_BUSY';
      busy.resourceKey = resourceKey;
      throw busy;
    }
    this.leases.push(Object.freeze({ resourceKey, lockPath, token: this.token }));
    try {
      await this.recoveryJournal?.recordResourceClaimAcquired({
        ...record,
        lockPath,
      });
    } catch (error) {
      throw new Error(
        `QA_RESOURCE_RECOVERY_JOURNAL_ACQUIRE_FAILED:${resourceKey}`,
        { cause: error },
      );
    }
  }

  async releaseAll() {
    return this.releaseClaims(this.leases.map((lease) => lease.resourceKey));
  }

  async releaseClaims(resourceClaims) {
    if (!Array.isArray(resourceClaims)
      || resourceClaims.some((claim) => typeof claim !== 'string' || !claim.trim())
      || new Set(resourceClaims).size !== resourceClaims.length) {
      throw new Error('QA_RESOURCE_RELEASE_CLAIMS_INVALID');
    }
    const selected = new Set(resourceClaims);
    for (const claim of selected) {
      if (!this.leases.some((lease) => lease.resourceKey === claim)) {
        throw new Error(`QA_RESOURCE_RELEASE_NOT_OWNED:${claim}`);
      }
    }
    const leases = this.leases.filter((lease) => selected.has(lease.resourceKey)).reverse();
    const retained = new Set(this.leases.filter((lease) => !selected.has(lease.resourceKey)));
    const released = [];
    const failures = [];
    for (const lease of leases) {
      try {
        let raw;
        try {
          raw = await fs.readFile(lease.lockPath, 'utf8');
        } catch (error) {
          if (error?.code === 'ENOENT') {
            await this.recoveryJournal?.recordResourceClaimReleased({
              resourceKey: lease.resourceKey,
              token: lease.token,
            });
            released.push(lease.resourceKey);
            continue;
          }
          throw error;
        }
        let current;
        try {
          current = JSON.parse(raw);
        } catch (error) {
          throw new Error(
            `QA_RESOURCE_LOCK_RECORD_INVALID:${lease.resourceKey}`,
            { cause: error },
          );
        }
        if (current?.token !== lease.token || current?.runId !== this.runId) {
          throw new Error(`QA_RESOURCE_LOCK_OWNERSHIP_LOST:${lease.resourceKey}`);
        }
        await fs.unlink(lease.lockPath).catch((error) => {
          if (error?.code !== 'ENOENT') throw error;
        });
        await this.recoveryJournal?.recordResourceClaimReleased({
          resourceKey: lease.resourceKey,
          token: lease.token,
        });
        released.push(lease.resourceKey);
      } catch (error) {
        retained.add(lease);
        failures.push(error);
      }
    }
    this.leases = this.leases.filter((lease) => retained.has(lease));
    if (failures.length > 0) {
      const aggregate = new AggregateError(
        failures,
        `QA_RESOURCE_RELEASE_INCOMPLETE:${failures.length}`,
      );
      aggregate.code = 'QA_RESOURCE_RELEASE_INCOMPLETE';
      throw aggregate;
    }
    return Object.freeze(released);
  }
}
