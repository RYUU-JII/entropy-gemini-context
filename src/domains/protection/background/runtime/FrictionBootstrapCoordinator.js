import { createFrictionBootstrapSnapshotBuilder } from './FrictionBootstrapSnapshotBuilder.js';
import {
  getBootstrapSnapshotInvalidation, isBootstrapHostnameAffected,
} from '../../../settings/config/bootstrapSnapshotInvalidation.js';

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireNonNegativeInteger(value, errorCode) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(errorCode);
  }
  return value;
}

function requireBootstrapSnapshot(snapshot, errorCode) {
  if (!isPlainObject(snapshot)) {
    throw new Error(errorCode);
  }
  const hostname = normalizeHostname(snapshot.host?.hostname);
  if (!hostname) {
    throw new Error(`${errorCode}:hostname`);
  }
  if (!Number.isInteger(snapshot.generatedAtEpochMs) || snapshot.generatedAtEpochMs <= 0) {
    throw new Error(`${errorCode}:generatedAtEpochMs`);
  }
  if (
    !Number.isInteger(snapshot.staleAfterEpochMs)
    || snapshot.staleAfterEpochMs <= snapshot.generatedAtEpochMs
  ) {
    throw new Error(`${errorCode}:staleAfterEpochMs`);
  }
  return {
    ...snapshot,
    host: {
      ...snapshot.host,
      hostname,
    },
  };
}

function buildSnapshotSignature(snapshot) {
  return JSON.stringify({
    host: snapshot?.host || null,
    decision: snapshot?.decision || null,
    visual: snapshot?.visual || null,
    runtime: snapshot?.runtime || null,
    meta: snapshot?.meta || null,
  });
}

export function createFrictionBootstrapCoordinator({
  settingsCache,
  bootstrapSnapshotRepository,
  snapshotBuilder = createFrictionBootstrapSnapshotBuilder({ settingsCache }),
  minRewriteIntervalMs = 15_000,
} = {}) {
  if (
    !bootstrapSnapshotRepository
    || typeof bootstrapSnapshotRepository.setFrictionSnapshot !== 'function'
    || typeof bootstrapSnapshotRepository.clearFrictionSnapshot !== 'function'
  ) {
    throw new Error('FRICTION_BOOTSTRAP_REPOSITORY_REQUIRED');
  }
  const resolvedMinRewriteIntervalMs = requireNonNegativeInteger(
    minRewriteIntervalMs,
    'FRICTION_BOOTSTRAP_REWRITE_INTERVAL_INVALID',
  );

  const lastWriteByHost = new Map();
  let cacheEpoch = 0;
  let cacheWorkTail = Promise.resolve();
  function enqueueCacheWork(work) {
    const pending = cacheWorkTail.then(work, work);
    // This tail schedules cache ownership; the returned operation retains errors.
    cacheWorkTail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async function refreshForRuntime({
    hostname,
    runtimeSnapshot,
    now = Date.now(),
    themePresentation = null,
    assertCurrent = null,
  } = {}) {
    if (assertCurrent !== null && typeof assertCurrent !== 'function') throw new Error('FRICTION_BOOTSTRAP_FRESHNESS_FENCE_INVALID');
    const admittedEpoch = cacheEpoch;
    return enqueueCacheWork(async () => {
      const assertFresh = () => {
        if (admittedEpoch !== cacheEpoch) throw new Error('FRICTION_BOOTSTRAP_REFRESH_SUPERSEDED');
        const result = assertCurrent?.();
        if (result && typeof result.then === 'function') throw new Error('FRICTION_BOOTSTRAP_FRESHNESS_FENCE_MUST_BE_SYNCHRONOUS');
      };
      assertFresh();
      const snapshot = requireBootstrapSnapshot(
        snapshotBuilder.build({
          hostname,
          runtimeSnapshot,
          now,
          themePresentation,
        }),
        'FRICTION_BOOTSTRAP_SNAPSHOT_INVALID',
      );

      const resolvedHostname = snapshot.host.hostname;
      const signature = buildSnapshotSignature(snapshot);
      const previousWrite = lastWriteByHost.get(resolvedHostname);

      if (
        previousWrite
        && previousWrite.signature === signature
        && (snapshot.generatedAtEpochMs - previousWrite.writtenAt) < resolvedMinRewriteIntervalMs
      ) {
        return snapshot;
      }

      assertFresh();
      const writtenSnapshot = requireBootstrapSnapshot(await bootstrapSnapshotRepository.setFrictionSnapshot(snapshot),
        'FRICTION_BOOTSTRAP_WRITE_RESULT_INVALID');
      try {
        assertFresh();
      } catch (error) {
        // The queue prevents a newer write from being erased by stale cleanup.
        lastWriteByHost.delete(resolvedHostname);
        await bootstrapSnapshotRepository.clearFrictionSnapshot({ hostname: resolvedHostname });
        throw error;
      }

      lastWriteByHost.set(resolvedHostname, {
        signature,
        writtenAt: snapshot.generatedAtEpochMs,
        staleAfterEpochMs: writtenSnapshot.staleAfterEpochMs,
      });
      return writtenSnapshot;
    });
  }

  function needsRefreshForHost({ hostname, now, marginMs = 60_000 } = {}) {
    const host = normalizeHostname(hostname);
    if (!host || !Number.isFinite(now) || now < 0 || !Number.isInteger(marginMs) || marginMs < 0) {
      throw new Error('FRICTION_BOOTSTRAP_FRESHNESS_INPUT_INVALID');
    }
    const previousWrite = lastWriteByHost.get(host);
    return previousWrite === undefined || now >= previousWrite.staleAfterEpochMs - marginMs;
  }

  async function clearCachedHost(hostname = '') {
    const resolvedHostname = normalizeHostname(hostname);
    if (!resolvedHostname) {
      lastWriteByHost.clear();
      await bootstrapSnapshotRepository.clearFrictionSnapshot();
      return;
    }

    lastWriteByHost.delete(resolvedHostname);
    await bootstrapSnapshotRepository.clearFrictionSnapshot({ hostname: resolvedHostname });
  }

  function clearFrictionSnapshot({ hostname = '' } = {}) {
    cacheEpoch += 1;
    return enqueueCacheWork(() => clearCachedHost(hostname));
  }

  async function clearAll(_reason = 'manual') {
    await clearFrictionSnapshot();
  }

  async function invalidateForSettingsChange({ changedKeys = null } = {}) {
    const invalidation = getBootstrapSnapshotInvalidation(changedKeys);
    if (invalidation.scope === 'none') return { scope: 'none', invalidatedHosts: [] };
    cacheEpoch += 1;
    return enqueueCacheWork(async () => {
      if (invalidation.scope === 'all') {
        // OFF/full reconcile must also remove malformed caches without reading them.
        await clearCachedHost();
        return { scope: 'all', invalidatedHosts: null };
      }
      const [rootSnapshots, frictionSnapshots] = await Promise.all([
        bootstrapSnapshotRepository.listRootVisualSnapshots(),
        bootstrapSnapshotRepository.listFrictionSnapshots(),
      ]);
      const invalidatedHosts = [...new Set([...rootSnapshots, ...frictionSnapshots]
        .map((snapshot) => snapshot.host.hostname))]
        .filter((hostname) => isBootstrapHostnameAffected(hostname, invalidation));
      // Typed store writes are read/modify/write; never clear hosts concurrently.
      for (const hostname of invalidatedHosts) await clearCachedHost(hostname);
      return { scope: invalidation.scope, invalidatedHosts };
    });
  }

  return {
    refreshForRuntime,
    needsRefreshForHost,
    clearAll,
    clearFrictionSnapshot,
    invalidateForSettingsChange,
  };
}
