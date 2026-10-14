import { pickEarlyRuntimeCompiledFeatures } from '../../settings/config/frictionPipeline.js';
import { readContentLoaderFrictionSnapshot } from '../../../platform/storage/bootstrap/contentLoaderRootVisualReader.js';
import {
  keyedProtectionEffects,
} from './ProtectionRegistry.js';
import {
  applyProtectionRuntimeEffects,
} from './runtime/ProtectionFrictionModifierRuntime.js';
import {
  recordProtectionBootstrap,
  recordProtectionEnvironmentProbe,
  recordProtectionFeatureError,
} from './runtime/protectionRuntimeDiagnostics.js';

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveHostname() {
  try {
    return normalizeHostname(window.location?.hostname || '');
  } catch (_) {
    return '';
  }
}

function pickEarlyRuntimeEffects(effects = [], filters = {}) {
  const keys = new Set(Object.keys(filters || {}));
  return effects.filter((effect) => keys.has(effect.key));
}

export async function applyEarlyRuntimeBootstrapSnapshot({
  hostname = resolveHostname(),
  now = Date.now(),
  source = 'content_bootstrap',
  assertAttemptCurrent = null,
} = {}) {
  const assertCurrent = (phase) => {
    if (typeof assertAttemptCurrent === 'function') {
      assertAttemptCurrent(`early_runtime_${phase}`);
    }
  };
  assertCurrent('start');
  const resolvedHostname = normalizeHostname(hostname);
  recordProtectionEnvironmentProbe({
    phase: 'early_runtime_bootstrap',
    source,
    hostname: resolvedHostname,
  });
  if (!resolvedHostname) {
    recordProtectionBootstrap({
      source,
      applied: false,
      reason: 'hostname_missing',
    });
    return null;
  }

  let snapshot = null;
  try {
    snapshot = await readContentLoaderFrictionSnapshot({
      hostname: resolvedHostname,
      now,
    });
    assertCurrent('snapshot_read');
  } catch (error) {
    assertCurrent('snapshot_read_failed');
    recordProtectionBootstrap({
      source,
      applied: false,
      hostname: resolvedHostname,
      reason: 'snapshot_read_failed',
      error: String(error?.message || error),
    });
    return null;
  }

  if (!snapshot?.decision?.shouldApply) {
    recordProtectionBootstrap({
      source,
      applied: false,
      hostname: resolvedHostname,
      reason: snapshot ? 'decision_not_applicable' : 'snapshot_missing',
      decision: snapshot?.decision || null,
    });
    return null;
  }

  const filters = pickEarlyRuntimeCompiledFeatures(snapshot.runtime);
  const runtimeKeys = Object.keys(filters).filter((key) => filters[key]?.isActive);
  if (runtimeKeys.length === 0) {
    recordProtectionBootstrap({
      source,
      applied: false,
      hostname: resolvedHostname,
      reason: 'no_active_runtime_filters',
      decision: snapshot.decision,
      runtimeKeys: Object.keys(filters),
    });
    return snapshot;
  }

  try {
    assertCurrent('effects_apply');
    applyProtectionRuntimeEffects(filters, {
      keyedEffects: pickEarlyRuntimeEffects(keyedProtectionEffects, filters),
      globalEffects: [],
    });
    recordProtectionBootstrap({
      source,
      applied: true,
      hostname: resolvedHostname,
      reason: 'early_runtime_applied',
      decision: snapshot.decision,
      runtimeKeys,
    });
  } catch (error) {
    runtimeKeys.forEach((runtimeKey) => {
      recordProtectionFeatureError(runtimeKey, error, {
        phase: 'early_runtime_bootstrap',
        runtimeKeys,
      });
    });
    recordProtectionBootstrap({
      source,
      applied: false,
      hostname: resolvedHostname,
      reason: 'apply_failed',
      error: String(error?.message || error),
      decision: snapshot.decision,
      runtimeKeys,
    });
  }

  return snapshot;
}

export default applyEarlyRuntimeBootstrapSnapshot;
