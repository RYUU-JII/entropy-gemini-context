import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import {
  runtimeSendMessageReliable,
} from '../../../../platform/messaging/runtime/runtimeMessaging.js';
import {
  requireFeedTempoCheckpointProfile,
} from '../../../../platform/storage/model/FeedTempoProfileCheckpointContract.js';
import {
  normalizeFeedTempoLearningEpisodeFact,
  normalizeFeedTempoShadowEvaluation,
  normalizeFeedTempoSurface,
} from './feedTempoContracts.js';

const DEFAULT_TIMEOUT_MS = 5_000;

function requireExactObject(value, keys, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(errorCode);
  }
  return value;
}

function requireCheckpointRevision(value, errorCode, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

function normalizeProfileState(value, surface) {
  if (value === null) return null;
  const normalized = requireFeedTempoCheckpointProfile(value, {
    checkpointUpdatedAt: value?.decayEvaluatedAt,
  });
  const expected = normalizeFeedTempoSurface(surface);
  if (
    normalized.surface.profileId !== expected.profileId
    || normalized.surface.semanticSurfaceId !== expected.semanticSurfaceId
    || normalized.surface.surfaceMode !== expected.surfaceMode
    || normalized.surface.contentClass !== expected.contentClass
  ) {
    throw new Error('FEED_TEMPO_PERSISTENCE_PROFILE_SURFACE_MISMATCH');
  }
  return normalized;
}

function normalizeRestoreResult(rawResult, surface) {
  const result = requireExactObject(
    rawResult,
    ['historyAdmission', 'checkpointDiscarded', 'checkpointFound', 'checkpointStateRevision', 'profileState'],
    'FEED_TEMPO_PERSISTENCE_RESTORE_RESULT_INVALID',
  );
  if (typeof result.checkpointFound !== 'boolean') {
    throw new Error('FEED_TEMPO_PERSISTENCE_CHECKPOINT_FOUND_INVALID');
  }
  if (result.checkpointDiscarded !== null && typeof result.checkpointDiscarded !== 'object') {
    throw new Error('FEED_TEMPO_PERSISTENCE_CHECKPOINT_DISCARDED_INVALID');
  }
  if (typeof result.historyAdmission !== 'string' || !result.historyAdmission || result.historyAdmission.length > 512) {
    throw new Error('FEED_TEMPO_HISTORY_ADMISSION_INVALID');
  }
  return Object.freeze({
    historyAdmission: result.historyAdmission,
    checkpointFound: result.checkpointFound,
    checkpointDiscarded: result.checkpointDiscarded,
    checkpointStateRevision: requireCheckpointRevision(
      result.checkpointStateRevision,
      'FEED_TEMPO_PERSISTENCE_RESTORE_REVISION_INVALID',
      { nullable: true },
    ),
    profileState: normalizeProfileState(result.profileState, surface),
  });
}

function normalizeCommitResult(rawResult, fact) {
  const result = requireExactObject(
    rawResult,
    [
      'checkpointStateRevision',
      'conflictCount',
      'evaluation',
      'profileState',
    ],
    'FEED_TEMPO_PERSISTENCE_COMMIT_RESULT_INVALID',
  );
  const conflictCount = requireCheckpointRevision(
    result.conflictCount,
    'FEED_TEMPO_PERSISTENCE_CONFLICT_COUNT_INVALID',
  );
  const profileState = normalizeProfileState(result.profileState, fact.surface);
  if (profileState === null) {
    throw new Error('FEED_TEMPO_PERSISTENCE_COMMIT_PROFILE_REQUIRED');
  }
  return Object.freeze({
    checkpointStateRevision: requireCheckpointRevision(
      result.checkpointStateRevision,
      'FEED_TEMPO_PERSISTENCE_COMMIT_REVISION_INVALID',
    ),
    conflictCount,
    evaluation: normalizeFeedTempoShadowEvaluation(
      result.evaluation,
      fact.surface,
    ),
    profileState,
  });
}

function normalizeSuccessfulResponse(delivery, errorCode) {
  if (!delivery || delivery.ok !== true) {
    const error = new Error(errorCode);
    error.cause = (
      delivery
      && typeof delivery.error === 'string'
      && delivery.error
    )
      ? delivery.error
      : 'RUNTIME_DELIVERY_FAILED';
    throw error;
  }
  const response = delivery.response;
  if (!response || typeof response !== 'object' || response.success !== true) {
    const responseError = (
      response
      && typeof response.error === 'string'
      && response.error
    )
      ? response.error
      : errorCode;
    const error = new Error(responseError);
    error.code = responseError;
    throw error;
  }
  if (!Object.prototype.hasOwnProperty.call(response, 'result')) {
    throw new Error(`${errorCode}_RESULT_MISSING`);
  }
  return response.result;
}

export class FeedTempoPersistenceClient {
  constructor({
    sendMessage = runtimeSendMessageReliable,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    if (typeof sendMessage !== 'function') {
      throw new Error('FEED_TEMPO_PERSISTENCE_TRANSPORT_REQUIRED');
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
      throw new Error('FEED_TEMPO_PERSISTENCE_TIMEOUT_INVALID');
    }
    this._sendMessage = sendMessage;
    this._timeoutMs = timeoutMs;
    this._historyAdmission = null;
  }

  async restoreSurface(surface) {
    const normalizedSurface = normalizeFeedTempoSurface(surface);
    const delivery = await this._sendMessage({
      action: MESSAGE_ACTIONS.GET_FEED_TEMPO_PROFILE_CHECKPOINT,
      surface: normalizedSurface,
    }, { timeoutMs: this._timeoutMs });
    const result = normalizeSuccessfulResponse(
      delivery,
      'FEED_TEMPO_PERSISTENCE_RESTORE_FAILED',
    );
    const restored = normalizeRestoreResult(result, normalizedSurface);
    this._historyAdmission = restored.historyAdmission;
    return restored;
  }

  async commitEpisode(rawFact) {
    if (this._historyAdmission === null) throw new Error('FEED_TEMPO_HISTORY_RESTORE_REQUIRED');
    const fact = normalizeFeedTempoLearningEpisodeFact(rawFact);
    const delivery = await this._sendMessage({
      action: MESSAGE_ACTIONS.COMMIT_FEED_TEMPO_PROFILE_EPISODE,
      historyAdmission: this._historyAdmission,
      fact,
    }, { timeoutMs: this._timeoutMs });
    const result = normalizeSuccessfulResponse(
      delivery,
      'FEED_TEMPO_PERSISTENCE_COMMIT_FAILED',
    );
    return normalizeCommitResult(result, fact);
  }
}

export default FeedTempoPersistenceClient;
