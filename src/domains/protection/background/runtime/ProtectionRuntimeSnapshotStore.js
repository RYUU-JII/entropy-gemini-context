import {
  normalizeInterventionPlan,
  normalizeObservation,
} from '../../contracts/protectionContracts.js';
import {
  normalizeStrategyDecision,
} from '../../strategy/contracts/strategyContracts.js';
import { requireCoolingCurveRuntimeState } from '../../contracts/coolingCurveRuntimeContract.js';

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireHostname(hostname) {
  const normalized = normalizeHost(hostname);
  if (!normalized) {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_STORE_HOSTNAME_REQUIRED');
  }
  return normalized;
}

function requirePlainObject(value, errorCode) {
  if (!isPlainObject(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireOptionalPlainObject(value, errorCode) {
  if (value === null || value === undefined) {
    return null;
  }
  return requirePlainObject(value, errorCode);
}

function requireNonNegativeInteger(value, errorCode) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(errorCode);
  }
  return value;
}

export function createProtectionRuntimeSnapshotStore() {
  const snapshotByHost = new Map();

  function get(hostname) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return null;
    return snapshotByHost.get(normalizedHostname) || null;
  }

  function set({
    hostname,
    plan,
    observation = null,
    revision = 0,
    strategy = null,
    recovery = null,
    effectiveness = null,
    coolingCurve,
  } = {}) {
    const normalizedHostname = requireHostname(hostname);
    const normalizedRevision = requireNonNegativeInteger(
      revision,
      'PROTECTION_RUNTIME_SNAPSHOT_STORE_REVISION_INVALID',
    );
    const resolvedPlan = requirePlainObject(
      plan,
      'PROTECTION_RUNTIME_SNAPSHOT_STORE_PLAN_REQUIRED',
    );
    const resolvedObservation = requireOptionalPlainObject(
      observation,
      'PROTECTION_RUNTIME_SNAPSHOT_STORE_OBSERVATION_INVALID',
    );
    const resolvedStrategy = requireOptionalPlainObject(
      strategy,
      'PROTECTION_RUNTIME_SNAPSHOT_STORE_STRATEGY_INVALID',
    );
    const resolvedRecovery = requireOptionalPlainObject(
      recovery,
      'PROTECTION_RUNTIME_SNAPSHOT_STORE_RECOVERY_INVALID',
    );
    const resolvedEffectiveness = requireOptionalPlainObject(
      effectiveness,
      'PROTECTION_RUNTIME_SNAPSHOT_STORE_EFFECTIVENESS_INVALID',
    );

    const nextSnapshot = {
      hostname: normalizedHostname,
      coolingCurve: { ...requireCoolingCurveRuntimeState(coolingCurve) },
      plan: normalizeInterventionPlan(resolvedPlan),
      observation: resolvedObservation ? normalizeObservation(resolvedObservation) : null,
      revision: normalizedRevision,
      strategy: resolvedStrategy ? normalizeStrategyDecision(resolvedStrategy) : null,
      recovery: resolvedRecovery ? { ...resolvedRecovery } : null,
      effectiveness: resolvedEffectiveness ? { ...resolvedEffectiveness } : null,
    };
    snapshotByHost.set(normalizedHostname, nextSnapshot);
    return nextSnapshot;
  }

  function clear(hostname) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) {
      snapshotByHost.clear();
      return;
    }
    snapshotByHost.delete(normalizedHostname);
  }

  return {
    get,
    set,
    clear,
  };
}
