import { requireConsumptionMemoryProjection, requireConsumptionMemoryRead } from '../../behavior/consumption/consumptionMemoryModel.js';

// One live entry-intensity policy. Eligibility and the ordinary Gate hold/pass
// policy remain separate; this value extends the Zen foreground entry wait only.
export const SHISHI_CONSUMPTION_PROFILE = Object.freeze({
  version: 'shishi_consumption_level_v3',
  maximumWaitExtensionMs: 3600,
  maximumEvidenceAgeMs: 120000,
  maximumUncertaintyMs: 150,
  quantumMs: 50,
  mediumAt: 0.35,
  highAt: 0.70,
});
const curve = (memory) => memory * memory * (3 - 2 * memory);
const effect = (memory) => SHISHI_CONSUMPTION_PROFILE.maximumWaitExtensionMs * curve(memory);

export function selectShishiConsumptionLevel({ enabled, memoryRead, now }) {
  if (typeof enabled !== 'boolean' || !Number.isSafeInteger(now) || now < 0) throw new Error('SHISHI_CONSUMPTION_INPUT_INVALID');
  requireConsumptionMemoryRead(memoryRead);
  if (!enabled) return { ...baselineShishiConsumptionLevel('setting_off', now), status: 'inactive' };
  if (memoryRead.status !== 'ready') return baselineShishiConsumptionLevel('memory_' + memoryRead.status, now);
  if (memoryRead.projection.evaluatedAt !== now) throw new Error('SHISHI_CONSUMPTION_QUERY_MISMATCH');
  return projectShishiConsumptionLevel({ enabled, consumption: memoryRead.projection });
}

export function baselineShishiConsumptionLevel(reason, evaluatedAt = null, throughAt = null) {
  return requireShishiConsumptionLevel({ contract: SHISHI_CONSUMPTION_PROFILE.version,
    status: 'baseline', band: null, waitExtensionMs: 0, reason, evaluatedAt, throughAt, uncertaintyMs: null });
}

export function requireShishiConsumptionLevel(value) {
  const keys = ['contract', 'status', 'band', 'waitExtensionMs', 'reason', 'evaluatedAt', 'throughAt', 'uncertaintyMs'];
  if (!value || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))
    || value.contract !== SHISHI_CONSUMPTION_PROFILE.version || !['baseline', 'inactive', 'adapted', 'remembered'].includes(value.status)
    || ![null, 'light', 'medium', 'high'].includes(value.band) || typeof value.reason !== 'string' || !value.reason
    || !Number.isSafeInteger(value.waitExtensionMs) || value.waitExtensionMs < 0
    || value.waitExtensionMs > SHISHI_CONSUMPTION_PROFILE.maximumWaitExtensionMs
    || value.waitExtensionMs % SHISHI_CONSUMPTION_PROFILE.quantumMs !== 0
    || ['evaluatedAt', 'throughAt'].some((key) => value[key] !== null && (!Number.isSafeInteger(value[key]) || value[key] < 0))
    || (value.uncertaintyMs !== null && (!Number.isFinite(value.uncertaintyMs) || value.uncertaintyMs < 0
      || value.uncertaintyMs > SHISHI_CONSUMPTION_PROFILE.maximumWaitExtensionMs))) throw new Error('SHISHI_CONSUMPTION_LEVEL_INVALID');
  if (['baseline', 'inactive'].includes(value.status) && (value.waitExtensionMs !== 0 || value.band !== null)) throw new Error('SHISHI_CONSUMPTION_BASELINE_INVALID');
  if (['adapted', 'remembered'].includes(value.status) && (value.evaluatedAt === null || value.throughAt === null
    || value.evaluatedAt < value.throughAt || value.band === null || value.uncertaintyMs === null)) throw new Error('SHISHI_CONSUMPTION_EVIDENCE_REQUIRED');
  return value;
}

export function projectShishiConsumptionLevel({ enabled, consumption }) {
  if (typeof enabled !== 'boolean') throw new Error('SHISHI_CONSUMPTION_ENABLED_INVALID');
  requireConsumptionMemoryProjection(consumption);
  const base = (reason) => baselineShishiConsumptionLevel(reason, consumption.evaluatedAt, consumption.throughAt);
  if (!enabled) return { ...base('setting_off'), status: 'inactive' };
  if (['unobserved', 'disabled', 'intervention'].includes(consumption.coverage.status)) return base('coverage_' + consumption.coverage.status);
  if (!Object.hasOwn(consumption, 'policyEvidence')) return base('policy_evidence_unavailable');
  const profile = SHISHI_CONSUMPTION_PROFILE;
  if (consumption.coverage.unobservedMs > profile.maximumEvidenceAgeMs) return base('observation_stale');
  const { lowerMemory, upperMemory } = consumption.policyEvidence;
  const uncertaintyMs = Math.max(0, effect(upperMemory) - effect(lowerMemory));
  if (uncertaintyMs >= profile.maximumUncertaintyMs) return { ...base('observation_uncertain'), uncertaintyMs };
  // Taper toward baseline before the uncertainty boundary. A marginally better
  // observation must not suddenly add the entire maximum extension.
  const extension = effect(lowerMemory) * (1 - uncertaintyMs / profile.maximumUncertaintyMs);
  return requireShishiConsumptionLevel({ ...base('bounded_consumption_memory'),
    status: consumption.coverage.status === 'unknown' ? 'remembered' : 'adapted',
    band: lowerMemory < profile.mediumAt ? 'light' : lowerMemory < profile.highAt ? 'medium' : 'high',
    waitExtensionMs: Math.round(extension / profile.quantumMs) * profile.quantumMs, uncertaintyMs });
}
