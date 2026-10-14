import {
  isGlobalNudgeProtocolScene,
  resolveNudgeProtocolScene,
} from '../protocols/nudgeProtocolScene.js';
import {
  GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
  advanceGlobalSentinelSimulationOnStroke,
  createGlobalSentinelSimulationState,
  isGlobalSentinelSimulationExpired,
  resolveGlobalSentinelSimulationProgress,
} from './nudgeGameGlobalSentinelProtocol.js';
import { SITE_FURIN_PROTOCOL_SYSTEM, createSiteFurinState, resolveSiteFurinProgress, advanceSiteFurinFrame } from './nudgeGameSiteFurinProtocol.js';

export const SENTINEL_PROTOCOL_ADAPTER_IDS = Object.freeze({
  SITE_FURIN: 'site_furin',
  GLOBAL_SENTINEL: 'global_sentinel',
});

export const siteFurinProtocolAdapter = Object.freeze({
  id: SENTINEL_PROTOCOL_ADAPTER_IDS.SITE_FURIN,
  protocolSystem: SITE_FURIN_PROTOCOL_SYSTEM,
  createState: createSiteFurinState,
  resolveProgress: resolveSiteFurinProgress,
  buildWorkerProgress: (progress) => ({ ...progress }),
  advanceFrame: (state, options) => advanceSiteFurinFrame(state, options),
});

export const globalSentinelProtocolAdapter = Object.freeze({
  id: SENTINEL_PROTOCOL_ADAPTER_IDS.GLOBAL_SENTINEL,
  protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
  createState({ now = Date.now() } = {}) {
    return createGlobalSentinelSimulationState({ now });
  },
  resolveProgress(state = null, config = null, options = {}) {
    return {
      protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
      ...resolveGlobalSentinelSimulationProgress(state, config, options),
    };
  },
  buildWorkerProgress(progress = {}) {
    return {
      protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
      gamePhase: progress.gamePhase,
      completed: progress.completed === true,
      failed: progress.failed === true,
    };
  },
  advanceAcceptedInput(state = null, config = null, options = {}) {
    return advanceGlobalSentinelSimulationOnStroke(state, config, options);
  },
  isExpired(state = null, config = null, options = {}) {
    return isGlobalSentinelSimulationExpired(state, config, options);
  },
});

export function resolveSentinelProtocolAdapter(input = {}) {
  if (input?.protocolSystem === GLOBAL_SENTINEL_PROTOCOL_SYSTEM || isGlobalNudgeProtocolScene(input)) {
    return globalSentinelProtocolAdapter;
  }
  if (input?.protocolSystem === SITE_FURIN_PROTOCOL_SYSTEM || input?.protocolScope === 'site') {
    return siteFurinProtocolAdapter;
  }
  const scene = resolveNudgeProtocolScene(input);
  return isGlobalNudgeProtocolScene(scene)
    ? globalSentinelProtocolAdapter
    : siteFurinProtocolAdapter;
}
