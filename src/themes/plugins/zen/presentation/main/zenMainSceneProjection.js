import { ZEN_APP_PETAL_PRESENTATIONS } from '../../runtime/petals/zenAppPetalPresentation.js';
import {
  MAIN_PRESENTATION_PHASES,
  MAIN_PRESENTATION_SCENE_KINDS,
} from '@/themes/core/presentation/mainSceneContract.js';
import {
  ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES,
  ZEN_BONSAI_PRESENTATION_MODES,
} from '@/themes/plugins/zen/model/ZenBonsaiPresentationPolicy.js';
import {
  ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODES,
} from '@/themes/plugins/zen/runtime/environment/zenWorldWeatherAuthority.js';

const freeze = (value) => Object.freeze(value);

export const ZEN_MAIN_SCENE_PROJECTION_SCHEMA_VERSION = 1;
export const ZEN_MAIN_SCENE_KINDS = MAIN_PRESENTATION_SCENE_KINDS;
export const ZEN_MAIN_SCENE_PHASES = MAIN_PRESENTATION_PHASES;

export const ZEN_MAIN_POND_PRESENTATION_MODES = freeze({
  CURRENT_RUNTIME: 'current_runtime',
  FIRST_VISION: 'first_vision',
});

export const ZEN_MAIN_POND_ROSTER_MEMORY_POLICIES = freeze({
  WRITE_CURRENT: 'write_current',
  BYPASS_PRESENTATION: 'bypass_presentation',
});

export const ZEN_MAIN_CULTIVATION_LEDGER_POLICIES = ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES;

export const ZEN_MAIN_INTERACTION_MODES = freeze({
  ENABLED: 'enabled',
  LOCKED: 'locked',
});

export const ZEN_MAIN_SELECTION_MUTATION_POLICIES = freeze({
  WRITE_CURRENT: 'write_current',
  LOCKED: 'locked',
});

export const ZEN_MAIN_OVERLAY_MODES = freeze({
  NONE: 'none',
  FIRST_VISION_DESCENT: 'first_vision_descent',
});

export const ZEN_MAIN_VISUAL_EMPHASIS_MODES = freeze({
  NONE: 'none',
  FIRST_VISION_FOCUS: 'first_vision_focus',
});

export const ZEN_MAIN_PROJECTION_SOURCES = freeze({
  CURRENT_RUNTIME: 'current_runtime',
  FIRST_VISION_SESSION: 'first_vision_session',
});

const FIRST_VISION_BIOTIC_PROFILE = 'first_vision_full_bloom';
const RUNTIME_BIOTIC_PROFILE = 'runtime';
const SCENE_KIND_SET = new Set(Object.values(MAIN_PRESENTATION_SCENE_KINDS));
const PHASE_SET = new Set(Object.values(MAIN_PRESENTATION_PHASES));
const FIRST_VISION_VISUAL_EMPHASIS_PHASES = new Set([
  MAIN_PRESENTATION_PHASES.PREPARING_FIRST_VISION,
  MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED,
  MAIN_PRESENTATION_PHASES.PRESENTING,
  MAIN_PRESENTATION_PHASES.COVERING,
  MAIN_PRESENTATION_PHASES.PREPARING_CURRENT,
  MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED,
  MAIN_PRESENTATION_PHASES.UNCOVERING,
]);

function requireDecision(mainPresentationDecision) {
  if (!mainPresentationDecision || typeof mainPresentationDecision !== 'object') {
    throw new Error('ZEN_MAIN_PRESENTATION_DECISION_REQUIRED');
  }
  if (!SCENE_KIND_SET.has(mainPresentationDecision.kind)) {
    throw new Error(`ZEN_MAIN_PRESENTATION_KIND_INVALID:${String(mainPresentationDecision.kind)}`);
  }
  if (!PHASE_SET.has(mainPresentationDecision.phase)) {
    throw new Error(`ZEN_MAIN_PRESENTATION_PHASE_INVALID:${String(mainPresentationDecision.phase)}`);
  }
  const renderKind = mainPresentationDecision.renderTarget?.kind;
  if (!SCENE_KIND_SET.has(renderKind)) {
    throw new Error(`ZEN_MAIN_PRESENTATION_RENDER_KIND_INVALID:${String(renderKind)}`);
  }
  const sceneCommitKey = typeof mainPresentationDecision.renderTarget?.sceneCommitKey === 'string'
    ? mainPresentationDecision.renderTarget.sceneCommitKey.trim()
    : '';
  if (!sceneCommitKey) {
    throw new Error('ZEN_MAIN_PRESENTATION_SCENE_COMMIT_KEY_REQUIRED');
  }
  return mainPresentationDecision;
}

function resolveOverlay(phase) {
  const active = [
    MAIN_PRESENTATION_PHASES.COVERING,
    MAIN_PRESENTATION_PHASES.PREPARING_CURRENT,
    MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED,
    MAIN_PRESENTATION_PHASES.UNCOVERING,
  ].includes(phase);
  return freeze({
    active,
    mode: active
      ? ZEN_MAIN_OVERLAY_MODES.FIRST_VISION_DESCENT
      : ZEN_MAIN_OVERLAY_MODES.NONE,
    holdAtCover: phase === MAIN_PRESENTATION_PHASES.PREPARING_CURRENT
      || phase === MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED,
    releaseCover: phase === MAIN_PRESENTATION_PHASES.UNCOVERING,
  });
}

function resolvePetals(phase) {
  switch (phase) {
    case MAIN_PRESENTATION_PHASES.FIRST_VISION_COMMITTED:
    case MAIN_PRESENTATION_PHASES.PRESENTING:
      return ZEN_APP_PETAL_PRESENTATIONS.OPENING;
    case MAIN_PRESENTATION_PHASES.COVERING:
      return ZEN_APP_PETAL_PRESENTATIONS.COVERING;
    case MAIN_PRESENTATION_PHASES.PREPARING_CURRENT:
    case MAIN_PRESENTATION_PHASES.CURRENT_COMMITTED:
      return ZEN_APP_PETAL_PRESENTATIONS.COVERED;
    case MAIN_PRESENTATION_PHASES.UNCOVERING:
      return ZEN_APP_PETAL_PRESENTATIONS.UNCOVERING;
    default:
      return ZEN_APP_PETAL_PRESENTATIONS.AMBIENT;
  }
}

function resolveVisualEmphasis(decision) {
  const active = decision.kind === MAIN_PRESENTATION_SCENE_KINDS.FIRST_VISION
    && FIRST_VISION_VISUAL_EMPHASIS_PHASES.has(decision.phase);
  return freeze({
    active,
    mode: active
      ? ZEN_MAIN_VISUAL_EMPHASIS_MODES.FIRST_VISION_FOCUS
      : ZEN_MAIN_VISUAL_EMPHASIS_MODES.NONE,
    chromeAttenuation: active ? 'subtle' : 'none',
    primarySurfaceGlow: active ? 'dream_edge' : 'none',
  });
}

export function resolveZenMainSceneProjection({
  mainPresentationDecision = null,
} = {}) {
  const decision = requireDecision(mainPresentationDecision);
  const renderKind = decision.renderTarget.kind;
  const sceneCommitKey = decision.renderTarget.sceneCommitKey;
  const firstVisionSession = decision.kind === MAIN_PRESENTATION_SCENE_KINDS.FIRST_VISION;
  const renderFirstVision = renderKind === MAIN_PRESENTATION_SCENE_KINDS.FIRST_VISION;
  const interactionLocked = firstVisionSession;
  const source = firstVisionSession
    ? ZEN_MAIN_PROJECTION_SOURCES.FIRST_VISION_SESSION
    : ZEN_MAIN_PROJECTION_SOURCES.CURRENT_RUNTIME;
  const overlay = resolveOverlay(decision.phase);
  const visualEmphasis = resolveVisualEmphasis(decision);

  return freeze({
    schemaVersion: ZEN_MAIN_SCENE_PROJECTION_SCHEMA_VERSION,
    sceneCommitKey,
    decision,
    visualEmphasis,
    petals: resolvePetals(decision.phase),
    pond: freeze({
      source,
      sceneCommitKey,
      presentationMode: renderFirstVision
        ? ZEN_MAIN_POND_PRESENTATION_MODES.FIRST_VISION
        : ZEN_MAIN_POND_PRESENTATION_MODES.CURRENT_RUNTIME,
      firstVisionPresentation: renderFirstVision,
      dataIsolationMode: renderFirstVision,
      environmentMode: renderFirstVision
        ? ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODES.CEREMONY_MIDDAY
        : ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODES.REALITY,
      bioticProfile: renderFirstVision
        ? FIRST_VISION_BIOTIC_PROFILE
        : RUNTIME_BIOTIC_PROFILE,
      rosterMemoryPolicy: renderFirstVision
        ? ZEN_MAIN_POND_ROSTER_MEMORY_POLICIES.BYPASS_PRESENTATION
        : ZEN_MAIN_POND_ROSTER_MEMORY_POLICIES.WRITE_CURRENT,
      interactionLocked,
    }),
    bonsai: freeze({
      source,
      sceneCommitKey,
      firstVisionPresentation: renderFirstVision,
      environmentMode: renderFirstVision
        ? ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODES.CEREMONY_MIDDAY
        : ZEN_SCENE_PRESENTATION_ENVIRONMENT_MODES.REALITY,
      profileMode: renderFirstVision
        ? ZEN_BONSAI_PRESENTATION_MODES.FIRST_VISION
        : ZEN_BONSAI_PRESENTATION_MODES.CURRENT_RUNTIME,
      cultivationLedgerPolicy: renderFirstVision
        ? ZEN_MAIN_CULTIVATION_LEDGER_POLICIES.READ_ONLY
        : ZEN_MAIN_CULTIVATION_LEDGER_POLICIES.WRITE_CURRENT,
      interactionLocked,
    }),
    rhythm: freeze({
      source,
      readMode: renderKind,
      interactionLocked,
      selectionMutation: interactionLocked
        ? ZEN_MAIN_SELECTION_MUTATION_POLICIES.LOCKED
        : ZEN_MAIN_SELECTION_MUTATION_POLICIES.WRITE_CURRENT,
    }),
    overlay: freeze({
      source,
      ...overlay,
    }),
    interaction: freeze({
      source,
      locked: interactionLocked,
      mode: interactionLocked
        ? ZEN_MAIN_INTERACTION_MODES.LOCKED
        : ZEN_MAIN_INTERACTION_MODES.ENABLED,
      allowLiveSelection: !interactionLocked,
      liveSelectionMode: interactionLocked
        ? ZEN_MAIN_INTERACTION_MODES.LOCKED
        : ZEN_MAIN_INTERACTION_MODES.ENABLED,
    }),
    diagnostics: freeze({
      degraded: decision.diagnostics?.degraded === true,
      reason: decision.diagnostics?.reason || null,
    }),
  });
}
