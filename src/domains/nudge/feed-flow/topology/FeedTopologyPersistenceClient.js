import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import {
  runtimeSendMessageReliable,
} from '../../../../platform/messaging/runtime/runtimeMessaging.js';
import {
  requireFeedTopologyCertificate,
} from '../../../../platform/storage/model/FeedTopologyCertificateCheckpointContract.js';
import {
  normalizeFeedTopologyObservationFact,
} from './feedTopologyCertificationContracts.js';
import {
  normalizeFeedTopologyCertificateSurface,
} from '../../../../platform/storage/model/FeedTopologyCertificateCheckpointContract.js';

const DEFAULT_TIMEOUT_MS = 5_000;
const EFFECTIVE_STATES = new Set([
  'none',
  'learning',
  'certified',
  'invalidated',
  'expired',
]);

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

function requireRevision(value, errorCode, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

function requireEffectiveState(value) {
  if (typeof value !== 'string' || !EFFECTIVE_STATES.has(value)) {
    throw new Error('FEED_TOPOLOGY_PERSISTENCE_EFFECTIVE_STATE_INVALID');
  }
  return value;
}

function normalizeCertificate(value, surface) {
  if (value === null) return null;
  const certificate = requireFeedTopologyCertificate(value);
  const expected = normalizeFeedTopologyCertificateSurface(surface);
  if (
    certificate.surface.hostname !== expected.hostname
    || certificate.surface.profileId !== expected.profileId
    || certificate.surface.semanticSurfaceId !== expected.semanticSurfaceId
    || certificate.surface.surfaceMode !== expected.surfaceMode
    || certificate.surface.contentClass !== expected.contentClass
  ) {
    throw new Error('FEED_TOPOLOGY_PERSISTENCE_CERTIFICATE_SURFACE_MISMATCH');
  }
  return certificate;
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

function normalizeRestoreResult(rawResult, surface) {
  const result = requireExactObject(
    rawResult,
    [
      'checkpointFound',
      'checkpointStateRevision',
      'effectiveState',
      'certificate',
    ],
    'FEED_TOPOLOGY_PERSISTENCE_RESTORE_RESULT_INVALID',
  );
  if (typeof result.checkpointFound !== 'boolean') {
    throw new Error('FEED_TOPOLOGY_PERSISTENCE_CHECKPOINT_FOUND_INVALID');
  }
  return Object.freeze({
    checkpointFound: result.checkpointFound,
    checkpointStateRevision: requireRevision(
      result.checkpointStateRevision,
      'FEED_TOPOLOGY_PERSISTENCE_RESTORE_REVISION_INVALID',
      { nullable: true },
    ),
    effectiveState: requireEffectiveState(result.effectiveState),
    certificate: normalizeCertificate(result.certificate, surface),
  });
}

function normalizeCommitResult(rawResult, fact) {
  const result = requireExactObject(
    rawResult,
    [
      'checkpointStateRevision',
      'conflictCount',
      'changed',
      'transition',
      'effectiveState',
      'certificate',
    ],
    'FEED_TOPOLOGY_PERSISTENCE_COMMIT_RESULT_INVALID',
  );
  if (typeof result.changed !== 'boolean') {
    throw new Error('FEED_TOPOLOGY_PERSISTENCE_CHANGED_INVALID');
  }
  if (typeof result.transition !== 'string' || !result.transition) {
    throw new Error('FEED_TOPOLOGY_PERSISTENCE_TRANSITION_INVALID');
  }
  return Object.freeze({
    checkpointStateRevision: requireRevision(
      result.checkpointStateRevision,
      'FEED_TOPOLOGY_PERSISTENCE_COMMIT_REVISION_INVALID',
      { nullable: !result.changed },
    ),
    conflictCount: requireRevision(
      result.conflictCount,
      'FEED_TOPOLOGY_PERSISTENCE_CONFLICT_COUNT_INVALID',
    ),
    changed: result.changed,
    transition: result.transition,
    effectiveState: requireEffectiveState(result.effectiveState),
    certificate: normalizeCertificate(result.certificate, fact.surface),
  });
}

export class FeedTopologyPersistenceClient {
  constructor({
    sendMessage = runtimeSendMessageReliable,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    if (typeof sendMessage !== 'function') {
      throw new Error('FEED_TOPOLOGY_PERSISTENCE_TRANSPORT_REQUIRED');
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
      throw new Error('FEED_TOPOLOGY_PERSISTENCE_TIMEOUT_INVALID');
    }
    this._sendMessage = sendMessage;
    this._timeoutMs = timeoutMs;
  }

  async restoreSurface(surface) {
    const normalizedSurface = normalizeFeedTopologyCertificateSurface(surface);
    const delivery = await this._sendMessage({
      action: MESSAGE_ACTIONS.GET_FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT,
      surface: normalizedSurface,
    }, { timeoutMs: this._timeoutMs });
    return normalizeRestoreResult(
      normalizeSuccessfulResponse(
        delivery,
        'FEED_TOPOLOGY_PERSISTENCE_RESTORE_FAILED',
      ),
      normalizedSurface,
    );
  }

  async commitObservation(rawFact) {
    const fact = normalizeFeedTopologyObservationFact(rawFact);
    const delivery = await this._sendMessage({
      action: MESSAGE_ACTIONS.COMMIT_FEED_TOPOLOGY_OBSERVATION,
      fact,
    }, { timeoutMs: this._timeoutMs });
    return normalizeCommitResult(
      normalizeSuccessfulResponse(
        delivery,
        'FEED_TOPOLOGY_PERSISTENCE_COMMIT_FAILED',
      ),
      fact,
    );
  }
}

export default FeedTopologyPersistenceClient;
