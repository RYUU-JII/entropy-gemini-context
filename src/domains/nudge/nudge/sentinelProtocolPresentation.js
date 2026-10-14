import {
  GLOBAL_SENTINEL_GAME_PHASES,
  GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
} from './nudgeGameGlobalSentinelProtocol.js';
import {
  SITE_FURIN_PROTOCOL_SYSTEM,
} from './nudgeGameSiteFurinProtocol.js';

function isGlobalProgress(progress = null) {
  return progress?.protocolSystem === GLOBAL_SENTINEL_PROTOCOL_SYSTEM;
}

function isSiteFurinProgress(progress = null) {
  return progress?.protocolSystem === SITE_FURIN_PROTOCOL_SYSTEM;
}

export const GLOBAL_SENTINEL_ACTION_MODES = Object.freeze({
  START: 'start',
  REPAIR: 'repair',
});

export const SITE_FURIN_ACTION_MODES = Object.freeze({

});

export function shouldShowSentinelRitualGuide({
  progress = null,
  hudVisible = false,
} = {}) {
  if (hudVisible) return false;
  if (isGlobalProgress(progress)) return false;
  return false;
}

export function resolveSentinelProtocolProgressPresentation(progress = null, {
  globalActionReady = true,
  siteActionReady = true,
} = {}) {
  const safeProgress = progress && typeof progress === 'object' ? progress : {};
  const global = isGlobalProgress(safeProgress);
  const site = isSiteFurinProgress(safeProgress);
  const globalGamePhase = global ? safeProgress.gamePhase : '';
  const globalActionMode = globalGamePhase === GLOBAL_SENTINEL_GAME_PHASES.AWAITING_START
    ? GLOBAL_SENTINEL_ACTION_MODES.START
    : (globalGamePhase === GLOBAL_SENTINEL_GAME_PHASES.REPAIR_RACE
      ? GLOBAL_SENTINEL_ACTION_MODES.REPAIR
      : '');
  return {
    sceneClasses: {
      'is-global-sentinel-simulation': global,
      'is-global-sentinel-awaiting-start': global
        && safeProgress.gamePhase === GLOBAL_SENTINEL_GAME_PHASES.AWAITING_START,
      'is-global-sentinel-learning': global
        && globalGamePhase === GLOBAL_SENTINEL_GAME_PHASES.REPAIR_RACE
        && safeProgress.strokeCount <= 2,
      'is-global-sentinel-scroll-locked': global
        && globalGamePhase !== GLOBAL_SENTINEL_GAME_PHASES.AWAITING_START,
      'is-global-sentinel-simulation-complete': global && safeProgress.completed === true,
      'is-global-sentinel-simulation-synced': global && safeProgress.failed === true,
      'is-site-furin-chime': site,
    },
    globalAction: {
      enabled: Boolean(
        globalActionMode
        && globalActionReady === true
        && safeProgress.completed !== true
        && safeProgress.failed !== true
      ),
      mode: globalActionMode,
    },
    siteAction: { enabled: false, mode: '' },
    styleVars: {
      '--nudge-ritual-progress': String(Number(safeProgress.progress) || 0),
      '--nudge-ritual-time-progress': String(Number(safeProgress.timeProgress) || 0),
      '--nudge-global-sentinel-simulation-progress': String(global ? Number(safeProgress.progress) || 0 : 0),
      '--nudge-global-sentinel-sync-level': String(global ? Number(safeProgress.syncLevel) || 0 : 0),
      '--nudge-global-sentinel-sync-pressure': String(global ? Number(safeProgress.syncPressure) || 0 : 0),
      '--nudge-global-sentinel-sync-pressure-relief': String(global ? Number(safeProgress.syncPressureRelief) || 0 : 0),
      '--nudge-global-sentinel-fracture': String(global ? Number(safeProgress.fracture) || 0 : 0),
      '--nudge-global-sentinel-integrity': String(global ? Number(safeProgress.sentinelIntegrity) || 0 : 0),
    },
    guideWakeProgress: site ? Number(safeProgress.progress) || 0 : 0,
  };
}
