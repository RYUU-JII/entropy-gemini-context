import {
  SENTINEL_FLARE_PROTOCOL_VARIANTS,
} from '../runtime/sentinelFlareProtocolProfile.js';
import {
  isGlobalNudgeProtocolScene,
  resolveNudgeProtocolScene,
} from '../protocols/nudgeProtocolScene.js';

export const NUDGE_SCENE_PHASES = Object.freeze({
  RITUAL: 'ritual',
  REFLECTION: 'reflection',
  BANISH: 'banish',
  RESYNCING: 'resyncing',
  COLLAPSE: 'collapse',
  RESYNC: 'resync',
  RIFT: 'rift',
  ESCAPE: 'escape',
});

export const NUDGE_ESCAPE_SEQUENCE_MS = 760;

const NUDGE_SCENE_PHASE_SET = new Set(Object.values(NUDGE_SCENE_PHASES));

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

export function isNudgeScenePhase(value) {
  return NUDGE_SCENE_PHASE_SET.has(value);
}

export function assertNudgeScenePhase(value, context = 'nudge_scene_phase') {
  if (isNudgeScenePhase(value)) return value;
  throw new Error(`${context}_invalid:${String(value)}`);
}

export function normalizeNudgeScenePhase(value, fallback = NUDGE_SCENE_PHASES.RITUAL) {
  if (value === null || value === undefined || value === '') {
    return assertNudgeScenePhase(fallback, 'nudge_scene_phase_fallback');
  }
  return assertNudgeScenePhase(value);
}

export function resolveNudgeScenePresentation({
  config = null,
  phase = NUDGE_SCENE_PHASES.RITUAL,
} = {}) {
  const scenePhase = normalizeNudgeScenePhase(phase);
  const protocolScene = resolveNudgeProtocolScene(config);
  const protocolScope = protocolScene.protocolScope;
  const isGlobalProtocol = isGlobalNudgeProtocolScene(protocolScene);
  const protocolVariant = protocolScene.protocolVariant;
  const intensity = clamp(protocolScene.protocolIntensity, 0.35, 1);
  const escapeActive = scenePhase === NUDGE_SCENE_PHASES.ESCAPE;
  const banishActive = scenePhase === NUDGE_SCENE_PHASES.BANISH;
  const resyncingActive = scenePhase === NUDGE_SCENE_PHASES.RESYNCING;
  const collapseActive = scenePhase === NUDGE_SCENE_PHASES.COLLAPSE;
  const resyncActive = scenePhase === NUDGE_SCENE_PHASES.RESYNC;
  const riftActive = scenePhase === NUDGE_SCENE_PHASES.RIFT;
  const terminalActive = escapeActive
    || banishActive
    || resyncingActive
    || collapseActive
    || resyncActive
    || riftActive;
  const globalEdgeOpacity = 0.42 + intensity * 0.46;
  const globalNoiseOpacity = 0.06 + intensity * 0.05;
  const globalGlitchOpacity = 0.12 + intensity * 0.2;
  const globalVignetteOpacity = 0.46 + intensity * 0.34;
  const globalRedSignalOpacity = 0.12 + intensity * 0.22;

  return {
    phase: scenePhase,
    protocolScope,
    protocolVariant,
    protocolScene,
    intensity,
    isGlobalProtocol,
    renderOptions: {
      protocolScope,
      protocolVariant,
      scenePhase,
      protocolIntensity: intensity,
    },
    sceneClasses: {
      'is-site-protocol': !isGlobalProtocol,
      'is-site-furin-protocol': !isGlobalProtocol
        && protocolVariant === SENTINEL_FLARE_PROTOCOL_VARIANTS.SITE_FURIN,
      'is-global-protocol': isGlobalProtocol,
      'is-global-sentinel-protocol': isGlobalProtocol
        && protocolVariant === SENTINEL_FLARE_PROTOCOL_VARIANTS.GLOBAL_SENTINEL,
      'is-scene-ritual': scenePhase === NUDGE_SCENE_PHASES.RITUAL,
      'is-scene-reflection': scenePhase === NUDGE_SCENE_PHASES.REFLECTION,
      'is-scene-banish': banishActive,
      'is-scene-resyncing': resyncingActive,
      'is-scene-collapse': collapseActive,
      'is-scene-resync': resyncActive,
      'is-scene-rift': riftActive,
      'is-scene-escape': escapeActive,
    },
    styleVars: {
      '--nudge-page-blur': isGlobalProtocol
        ? `${3.8 + intensity * 2.4}px`
        : `${1.6 + intensity * 1.4}px`,
      '--nudge-page-dim': isGlobalProtocol
        ? `${0.24 + intensity * 0.18}`
        : `${0.18 + intensity * 0.12}`,
      '--nudge-protocol-edge-opacity': isGlobalProtocol ? `${globalEdgeOpacity}` : '0',
      '--nudge-protocol-edge-width': isGlobalProtocol
        ? `${Math.round(12 + intensity * 12)}px`
        : '0px',
      '--nudge-protocol-noise-opacity': isGlobalProtocol ? `${globalNoiseOpacity}` : '0',
      '--nudge-protocol-vignette-opacity': isGlobalProtocol ? `${globalVignetteOpacity}` : '0',
      '--nudge-protocol-glitch-opacity': isGlobalProtocol ? `${globalGlitchOpacity}` : '0',
      '--nudge-protocol-red-signal-opacity': isGlobalProtocol ? `${globalRedSignalOpacity}` : '0',
      '--nudge-protocol-collapse-opacity': terminalActive ? '1' : '0',
      '--nudge-protocol-collapse-blur': terminalActive
        ? (isGlobalProtocol ? ((resyncActive || resyncingActive) ? '3px' : '8px') : '5px')
        : '0px',
    },
  };
}
