import {
  NUDGE_SCENE_PHASES,
} from '../nudge/nudgeGameScene.js';
import {
  globalSentinelProtocolAdapter,
  siteFurinProtocolAdapter,
} from '../nudge/sentinelProtocolAdapters.js';
import {
  createNudgeRuntimeState,
} from './NudgeRuntimeMachine.js';
import {
  SENTINEL_PROTOCOL_HOST_DEFAULT_WORKER_RUNTIME_HOST,
} from './SentinelProtocolWorkerBridge.js';
import { normalizeSentinelFlareDeliveryForm } from './sentinelFlareDeliveryForm.js';

export { SENTINEL_PROTOCOL_HOST_DEFAULT_WORKER_RUNTIME_HOST };

export function hasSentinelProtocolConfigChanged(previousConfig = null, nextConfig = null) {
  const previousProtocolScope = previousConfig?.protocolScope || '';
  const previousProtocolVariant = previousConfig?.protocolVariant || '';
  return !!(
    (previousProtocolScope && previousProtocolScope !== nextConfig?.protocolScope)
    || (previousProtocolVariant && previousProtocolVariant !== nextConfig?.protocolVariant)
    || normalizeSentinelFlareDeliveryForm(previousConfig?.deliveryForm) !== normalizeSentinelFlareDeliveryForm(nextConfig?.deliveryForm)
  );
}

export function resolveSentinelProtocolStartAdmission({
  active = false,
  currentMode = 'auto',
  incomingMode = 'auto',
} = {}) {
  if (active && currentMode !== 'debug' && incomingMode === 'debug') {
    return {
      accepted: false,
      rejectReason: 'debug_control_blocked_by_production',
    };
  }
  if (active && currentMode === 'debug' && incomingMode !== 'debug') {
    return {
      accepted: false,
      rejectReason: 'production_control_blocked_by_debug',
    };
  }
  if (active) return { accepted: false, rejectReason: 'intervention_already_active' };
  return {
    accepted: true,
    rejectReason: '',
  };
}

export function createSentinelProtocolStatePair({
  now = 0,
  config = null,
  isGlobalProtocolActive = false,
} = {}) {
  return {
    globalSentinelSimulationState: globalSentinelProtocolAdapter.createState({ now }),
    siteFurinState: siteFurinProtocolAdapter.createState({
      now,
      config: isGlobalProtocolActive ? null : config,
    }),
  };
}

export function buildSentinelProtocolHostStopModel({
  resetState = {},
  runtimeState = createNudgeRuntimeState(),
  workerRuntimeHost = SENTINEL_PROTOCOL_HOST_DEFAULT_WORKER_RUNTIME_HOST,
} = {}) {
  return {
    mode: 'auto',
    workerRuntimeHost,
    activeNudgeKey: null,
    activeNudgeRunId: null,
    lifecycleFinalAction: null,
    lifecyclePresentedSent: false,
    lifecycleEpisodeAbsorbedSent: false,
    startedAtMs: 0,
    protocolStartAt: Number(resetState.protocolStartAt) || 0,
    scenePhase: NUDGE_SCENE_PHASES.RITUAL,
    ritualGuideWakeProgress: 0,
    telemetryConsoleAnnounced: resetState.telemetryConsoleAnnounced === true,
    telemetryPublication: resetState.telemetryPublication || null,
    lastRuntimeError: resetState.lastRuntimeError || '',
    runtimeStage: resetState.runtimeStage || 'idle',
    runtimeState,
    canvasRuntimeOwner: 'layout',
    lastHudUpdateAt: Number(resetState.lastHudUpdateAt) || 0,
  };
}
