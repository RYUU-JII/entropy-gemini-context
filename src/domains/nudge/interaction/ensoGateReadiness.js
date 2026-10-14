import { recordProtectionFeatureEvent } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { isEnsoGateEligibleClickBoundary, isRewardClickBoundary } from './ClickBoundaryClassifier.js';
import { resolveEnsoGateConfig as resolveTimeline } from './EnsoGateTimeline.js';
import { resolveEnsoGateGestureConfig } from './EnsoGateGesture.js';
import ensoSpawnPolicy, { ENSO_SPAWN_SOURCES } from './EnsoSpawnPolicy.js';
import admissionClient from '../runtime/interventionAdmissionClient.js';
import { CLICK_ENSO_LEAVE_FEEDBACK_MS } from './interactionConstants.js';
import { state } from './interactionState.js';

export function getWakePresentationMs(config = null) {
  return Math.max(CLICK_ENSO_LEAVE_FEEDBACK_MS, Math.round(Number(config?.wakePresentationMs) || 0));
}
export function resolveEnsoGateConfig() {
  const source = state.ensoGateConfig || {};
  return { ...resolveTimeline(source), gesture: resolveEnsoGateGestureConfig(source, {
    viewportWidth: globalThis.window?.innerWidth, viewportHeight: globalThis.window?.innerHeight,
  }) };
}
export function getEnsoGateReadiness(resolution = null, now = Date.now(), { forceEntryForDebug = false } = {}) {
  const config = resolveEnsoGateConfig();
  const cadence = admissionClient.getEnsoCadence();
  const spawn = ensoSpawnPolicy.evaluate({ source: ENSO_SPAWN_SOURCES.CLICK_INTENT, now });
  const boundary = resolution?.clickBoundary;
  const base = { ready: false, reason: 'enso_interval_pending', enabled: config.enabled,
    mode: 'interval', cadence, spawnPolicyReason: spawn.reason,
    boundaryKind: boundary?.kind || 'none', boundaryBrake: boundary?.brake || null,
    boundaryConfidence: boundary?.confidence ?? null, activeEpisode: spawn.activeEpisode };
  if (!resolution?.target) return { ...base, reason: 'missing_target' };
  if (!isRewardClickBoundary(boundary)) return { ...base, reason: 'non_reward_boundary' };
  if (!config.enabled) return { ...base, reason: 'disabled' };
  if (!isEnsoGateEligibleClickBoundary(boundary)) return { ...base, reason: 'boundary_not_enso_gate_eligible' };
  if (!forceEntryForDebug && cadence?.eligible !== true) return { ...base, reason: cadence?.reason || 'enso_cadence_unavailable' };
  if (!spawn.allowed) return { ...base, reason: spawn.reason };
  return { ...base, ready: true, reason: forceEntryForDebug ? 'force_debug' : 'enso_consumption_interval_due' };
}
export function summarizeEnsoGateReadiness(readiness = null) {
  if (!readiness) return null;
  return { ready: readiness.ready, reason: readiness.reason, mode: readiness.mode,
    spawnPolicyReason: readiness.spawnPolicyReason, boundaryKind: readiness.boundaryKind,
    boundaryBrake: readiness.boundaryBrake, boundaryConfidence: readiness.boundaryConfidence,
    cadence: readiness.cadence };
}
export function recordEnsoBoundary(resolution, mode) {
  if (!isRewardClickBoundary(resolution?.clickBoundary)) return;
  recordProtectionFeatureEvent('ensoGate', 'enso_content_boundary_observed', {
    mode, kind: resolution.clickBoundary.kind, confidence: resolution.clickBoundary.confidence,
  });
}
