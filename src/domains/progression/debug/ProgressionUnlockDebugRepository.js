import { BUILD_INCLUDE_DEBUG_TOOLS } from '../../../platform/build/releaseCapabilities.js';
import { PROGRESSION_FIRST_VISION_STATES } from '../contracts/progressionIds.js';
import RuntimeSessionRepository, {
  STORAGE_SESSION_KEYS,
} from '../../../platform/storage/runtime/RuntimeSessionRepository.js';
import {
  normalizeProgressionUnlockDebugDay,
} from '../policy/progressionUnlockPolicy.js';
import {
  PROGRESSION_UNLOCK_DEBUG_CONTRACT,
  PROGRESSION_UNLOCK_DEBUG_MODES,
  buildDefaultProgressionUnlockDebugProjection,
  normalizeProgressionUnlockDebugMode,
  projectArtifactDisclosureSnapshotForProgressionUnlockDevelopment,
  requireProgressionUnlockDebugProjection,
} from './progressionUnlockDebugContract.dev.js';

function buildStoredProjection({ mode, dayCount, updatedAtMs }) {
  return requireProgressionUnlockDebugProjection({
    contract: PROGRESSION_UNLOCK_DEBUG_CONTRACT,
    mode: normalizeProgressionUnlockDebugMode(mode),
    dayCount,
    updatedAtMs,
  });
}

function requireDebugBuild() {
  if (!BUILD_INCLUDE_DEBUG_TOOLS) {
    throw new Error('PROGRESSION_UNLOCK_DEBUG_UNAVAILABLE');
  }
}

export class ProgressionUnlockDebugRepository {
  constructor({ sessionRepository = RuntimeSessionRepository.getInstance() } = {}) {
    this.sessionRepository = sessionRepository;
  }

  static getInstance() {
    if (!ProgressionUnlockDebugRepository.instance) {
      ProgressionUnlockDebugRepository.instance = new ProgressionUnlockDebugRepository();
    }
    return ProgressionUnlockDebugRepository.instance;
  }

  async readProjection() {
    if (!BUILD_INCLUDE_DEBUG_TOOLS) return null;
    const result = await this.sessionRepository.readOptional(
      STORAGE_SESSION_KEYS.PROGRESSION_UNLOCK_DEBUG,
    );
    if (!result.found) {
      return buildDefaultProgressionUnlockDebugProjection();
    }
    return requireProgressionUnlockDebugProjection(result.value);
  }

  async setMode(mode, { dayCount = null, updatedAtMs = Date.now() } = {}) {
    requireDebugBuild();
    if (!Number.isSafeInteger(updatedAtMs) || updatedAtMs < 0) {
      throw new Error('PROGRESSION_UNLOCK_DEBUG_TIMESTAMP_INVALID');
    }
    const normalizedMode = normalizeProgressionUnlockDebugMode(mode);
    if (
      normalizedMode === PROGRESSION_UNLOCK_DEBUG_MODES.CANONICAL
      && dayCount !== null
    ) {
      throw new Error('PROGRESSION_UNLOCK_DEBUG_CANONICAL_DAY_COUNT_FORBIDDEN');
    }
    const current = await this.readProjection();
    const revisionTime = Math.max(updatedAtMs, current.updatedAtMs + 1);
    if (!Number.isSafeInteger(revisionTime)) {
      throw new Error('PROGRESSION_UNLOCK_DEBUG_REVISION_EXHAUSTED');
    }
    const next = buildStoredProjection({
      mode: normalizedMode,
      dayCount: normalizedMode === PROGRESSION_UNLOCK_DEBUG_MODES.CANONICAL
        ? null
        : normalizeProgressionUnlockDebugDay(dayCount),
      updatedAtMs: revisionTime,
    });
    await this.sessionRepository.set({
      [STORAGE_SESSION_KEYS.PROGRESSION_UNLOCK_DEBUG]: next,
    });
    return next;
  }

  setDay(dayCount, options = {}) {
    return this.setMode(PROGRESSION_UNLOCK_DEBUG_MODES.DEVELOP, {
      ...options,
      dayCount,
    });
  }

  setCanonicalMode(options = {}) {
    return this.setMode(PROGRESSION_UNLOCK_DEBUG_MODES.CANONICAL, options);
  }

  // Production commands enter through ProgressionService's one queue. Comparing
  // the exact persisted descriptor and writing within that queue makes a replay
  // completion conditional on the selection that actually started it.
  async completeReplay(expectedProjection, { updatedAtMs = Date.now() } = {}) {
    requireDebugBuild();
    const expected = requireProgressionUnlockDebugProjection(expectedProjection);
    if (expected.mode !== PROGRESSION_UNLOCK_DEBUG_MODES.FIRST_VISION_PREVIEW) {
      throw new Error('PROGRESSION_FIRST_VISION_PREVIEW_COMPLETION_REQUIRED');
    }
    const current = await this.readProjection();
    const matches = ['contract', 'mode', 'dayCount', 'updatedAtMs']
      .every(key => current[key] === expected[key]);
    if (!matches) return Object.freeze({ applied: false, projection: current });
    const projection = await this.setMode(PROGRESSION_UNLOCK_DEBUG_MODES.DEVELOP, {
      dayCount: expected.dayCount,
      updatedAtMs,
    });
    return Object.freeze({ applied: true, projection });
  }

  async clearStoredProjectionForQaProvisioning() {
    requireDebugBuild();
    const stored = await this.sessionRepository.readOptional(
      STORAGE_SESSION_KEYS.PROGRESSION_UNLOCK_DEBUG,
    );
    if (stored.found) {
      await this.readProjection();
      await this.sessionRepository.remove(STORAGE_SESSION_KEYS.PROGRESSION_UNLOCK_DEBUG);
    }
    const verified = await this.sessionRepository.readOptional(
      STORAGE_SESSION_KEYS.PROGRESSION_UNLOCK_DEBUG,
    );
    if (verified.found) {
      throw new Error('PROGRESSION_QA_DEBUG_SESSION_CLEAR_FAILED');
    }
    return Object.freeze({
      cleared: stored.found,
      absent: true,
    });
  }

  projectArtifactDisclosureSnapshot(artifactDisclosureSnapshot, developmentProjection) {
    return projectArtifactDisclosureSnapshotForProgressionUnlockDevelopment(
      artifactDisclosureSnapshot,
      developmentProjection,
    );
  }

  projectFirstVisionState(canonicalState, developmentProjection) {
    const projection = requireProgressionUnlockDebugProjection(developmentProjection);
    if (projection.mode === PROGRESSION_UNLOCK_DEBUG_MODES.CANONICAL) return canonicalState;
    return projection.mode === PROGRESSION_UNLOCK_DEBUG_MODES.FIRST_VISION_PREVIEW
      ? PROGRESSION_FIRST_VISION_STATES.PENDING
      : PROGRESSION_FIRST_VISION_STATES.SPENT;
  }
}

export default ProgressionUnlockDebugRepository;
