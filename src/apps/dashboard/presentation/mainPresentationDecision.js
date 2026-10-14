import {
  MAIN_PRESENTATION_PHASES,
  MAIN_PRESENTATION_SCENE_KINDS,
  MAIN_PRESENTATION_TIME_SCOPE_MODES,
} from '../../../themes/core/presentation/mainSceneContract.js';

export {
  MAIN_PRESENTATION_PHASES,
  MAIN_PRESENTATION_SCENE_KINDS,
  MAIN_PRESENTATION_TIME_SCOPE_MODES,
};

const freeze = (value) => Object.freeze(value);

const SCENE_KIND_SET = new Set(Object.values(MAIN_PRESENTATION_SCENE_KINDS));
const PHASE_SET = new Set(Object.values(MAIN_PRESENTATION_PHASES));

function requireEnumValue(value, allowed, label) {
  if (!allowed.has(value)) {
    throw new Error(`MAIN_PRESENTATION_${label}_INVALID:${String(value)}`);
  }
  return value;
}

function normalizeEpochMs(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

export function createMainPresentationSession({
  sceneSessionId = '',
  startedAtEpochMs = Date.now(),
} = {}) {
  const normalizedStartedAt = normalizeEpochMs(startedAtEpochMs, Date.now());
  const normalizedSessionId = typeof sceneSessionId === 'string' && sceneSessionId.trim()
    ? sceneSessionId.trim()
    : `main_presentation:${normalizedStartedAt}`;
  return freeze({
    sceneSessionId: normalizedSessionId,
    startedAtEpochMs: normalizedStartedAt,
  });
}

export function buildMainPresentationSceneCommitKey(sceneSessionId, renderKind) {
  const normalizedSessionId = typeof sceneSessionId === 'string' && sceneSessionId.trim()
    ? sceneSessionId.trim()
    : null;
  if (!normalizedSessionId) {
    throw new Error('MAIN_PRESENTATION_SCENE_SESSION_ID_REQUIRED');
  }
  const normalizedRenderKind = requireEnumValue(
    renderKind,
    SCENE_KIND_SET,
    'RENDER_KIND',
  );
  return `${normalizedSessionId}:render:${normalizedRenderKind}`;
}

export function buildMainPresentationDecision({
  sceneSession,
  kind = MAIN_PRESENTATION_SCENE_KINDS.CURRENT,
  renderKind = kind,
  phase = MAIN_PRESENTATION_PHASES.SETTLED,
  themeId = '',
  bootId = '',
  generatedAtEpochMs = Date.now(),
  reason = 'unspecified',
  diagnostics = null,
} = {}) {
  if (!sceneSession || typeof sceneSession !== 'object') {
    throw new Error('MAIN_PRESENTATION_SCENE_SESSION_REQUIRED');
  }
  const normalizedKind = requireEnumValue(kind, SCENE_KIND_SET, 'SCENE_KIND');
  const normalizedRenderKind = requireEnumValue(renderKind, SCENE_KIND_SET, 'RENDER_KIND');
  const normalizedPhase = requireEnumValue(phase, PHASE_SET, 'PHASE');
  const sessionId = typeof sceneSession.sceneSessionId === 'string'
    ? sceneSession.sceneSessionId.trim()
    : '';
  if (!sessionId) {
    throw new Error('MAIN_PRESENTATION_SCENE_SESSION_ID_REQUIRED');
  }
  const firstVision = normalizedKind === MAIN_PRESENTATION_SCENE_KINDS.FIRST_VISION;
  const timeScopeMode = firstVision
    ? MAIN_PRESENTATION_TIME_SCOPE_MODES.FIRST_INSTALL_IDEAL
    : MAIN_PRESENTATION_TIME_SCOPE_MODES.CURRENT_CYCLE;

  return freeze({
    schemaVersion: 1,
    sceneId: `${sessionId}:${normalizedKind}`,
    sceneSessionId: sessionId,
    kind: normalizedKind,
    phase: normalizedPhase,
    renderTarget: freeze({
      kind: normalizedRenderKind,
      sceneCommitKey: buildMainPresentationSceneCommitKey(sessionId, normalizedRenderKind),
    }),
    source: freeze({
      themeId: typeof themeId === 'string' ? themeId : '',
      bootId: typeof bootId === 'string' ? bootId : '',
      generatedAtEpochMs: normalizeEpochMs(generatedAtEpochMs),
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'unspecified',
    }),
    timeScope: freeze({
      mode: timeScopeMode,
      dayKey: null,
      resetHour: null,
      timezone: null,
    }),
    session: freeze({
      startedAtEpochMs: normalizeEpochMs(sceneSession.startedAtEpochMs),
      selectionLocked: normalizedKind === MAIN_PRESENTATION_SCENE_KINDS.FIRST_VISION
        && normalizedPhase !== MAIN_PRESENTATION_PHASES.SETTLED
        && normalizedPhase !== MAIN_PRESENTATION_PHASES.DEFERRED,
    }),
    diagnostics: freeze({
      degraded: diagnostics?.degraded === true,
      reason: typeof diagnostics?.reason === 'string' && diagnostics.reason.trim()
        ? diagnostics.reason.trim()
        : null,
    }),
  });
}
