import FeedTopologyCertificateCheckpointRepository from '../../../../platform/storage/model/FeedTopologyCertificateCheckpointRepository.js';
import {
  resolveProfileResetGeneration,
} from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import {
  applyFeedTopologyObservationToCheckpoint,
  restoreFeedTopologyCertificate,
} from './feedTopologyCertificateModel.js';
import {
  normalizeFeedTopologyObservationFact,
} from './feedTopologyCertificationContracts.js';
import {
  normalizeFeedTopologyCertificateSurface,
} from '../../../../platform/storage/model/FeedTopologyCertificateCheckpointContract.js';

const DEFAULT_CAS_ATTEMPT_LIMIT = 4;

function requireOwnerMethod(owner, method, errorCode) {
  if (!owner || typeof owner[method] !== 'function') throw new Error(errorCode);
  return owner[method].bind(owner);
}

function requireNow(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('FEED_TOPOLOGY_PERSISTED_CERTIFICATE_TIME_INVALID');
  }
  return value;
}

function cloneCertificate(certificate) {
  if (!certificate) return null;
  return {
    ...certificate,
    surface: { ...certificate.surface },
    descriptor: { ...certificate.descriptor },
    observationDays: [...certificate.observationDays],
    recentObservationIds: [...certificate.recentObservationIds],
  };
}

export class FeedTopologyPersistentCertificationService {
  constructor({
    checkpointRepository = FeedTopologyCertificateCheckpointRepository.getInstance(),
    profileLifecycleRepository,
    now = () => Date.now(),
    casAttemptLimit = DEFAULT_CAS_ATTEMPT_LIMIT,
  } = {}) {
    this._readCheckpoint = requireOwnerMethod(
      checkpointRepository,
      'read',
      'FEED_TOPOLOGY_PERSISTED_CERTIFICATE_READ_OWNER_REQUIRED',
    );
    this._compareAndSetCheckpoint = requireOwnerMethod(
      checkpointRepository,
      'compareAndSet',
      'FEED_TOPOLOGY_PERSISTED_CERTIFICATE_CAS_OWNER_REQUIRED',
    );
    this._readLifecycle = requireOwnerMethod(
      profileLifecycleRepository,
      'read',
      'FEED_TOPOLOGY_PERSISTED_CERTIFICATE_LIFECYCLE_READ_OWNER_REQUIRED',
    );
    this._assertWriteAdmission = requireOwnerMethod(
      profileLifecycleRepository,
      'assertWriteAdmission',
      'FEED_TOPOLOGY_PERSISTED_CERTIFICATE_LIFECYCLE_ADMISSION_OWNER_REQUIRED',
    );
    if (typeof now !== 'function') {
      throw new Error('FEED_TOPOLOGY_PERSISTED_CERTIFICATE_CLOCK_REQUIRED');
    }
    if (!Number.isSafeInteger(casAttemptLimit) || casAttemptLimit < 1) {
      throw new Error('FEED_TOPOLOGY_PERSISTED_CERTIFICATE_CAS_LIMIT_INVALID');
    }
    this._now = now;
    this._casAttemptLimit = casAttemptLimit;
  }

  async restoreSurface(surface) {
    const normalizedSurface = normalizeFeedTopologyCertificateSurface(surface);
    const restoredAt = requireNow(this._now());
    const profileEpoch = await this._resolveAdmittedProfileEpoch();
    const stored = await this._readCheckpoint({ profileEpoch });
    await this._assertWriteAdmission({ expectedResetId: profileEpoch });
    const restored = restoreFeedTopologyCertificate({
      checkpoint: stored.checkpoint,
      profileEpoch,
      surface: normalizedSurface,
      now: restoredAt,
    });
    return Object.freeze({
      checkpointFound: restored.checkpointFound,
      checkpointStateRevision: restored.checkpointStateRevision,
      effectiveState: restored.effectiveState,
      certificate: restored.certificate
        ? Object.freeze(cloneCertificate(restored.certificate))
        : null,
    });
  }

  async commitObservation(rawFact) {
    const fact = normalizeFeedTopologyObservationFact(rawFact);
    const profileEpoch = await this._resolveAdmittedProfileEpoch();
    let stored = await this._readCheckpoint({ profileEpoch });

    for (let attempt = 1; attempt <= this._casAttemptLimit; attempt += 1) {
      const updateAt = Math.max(
        requireNow(this._now()),
        fact.observedAt,
        stored.checkpoint?.updatedAt || 0,
      );
      const prepared = applyFeedTopologyObservationToCheckpoint({
        checkpoint: stored.checkpoint,
        profileEpoch,
        fact,
        now: updateAt,
      });
      if (!prepared.changed) {
        await this._assertWriteAdmission({ expectedResetId: profileEpoch });
        return Object.freeze({
          checkpointStateRevision: prepared.checkpoint?.stateRevision ?? null,
          conflictCount: attempt - 1,
          changed: false,
          transition: prepared.transition,
          effectiveState: prepared.effectiveState,
          certificate: prepared.certificate
            ? Object.freeze(cloneCertificate(prepared.certificate))
            : null,
        });
      }
      const expectedRevision = stored.checkpoint
        ? stored.checkpoint.stateRevision
        : null;
      const result = await this._compareAndSetCheckpoint({
        profileEpoch,
        expectedRevision,
        nextCheckpoint: prepared.checkpoint,
      });
      if (result.outcome === 'committed' && result.written === true) {
        await this._assertWriteAdmission({ expectedResetId: profileEpoch });
        return Object.freeze({
          checkpointStateRevision: prepared.checkpoint.stateRevision,
          conflictCount: attempt - 1,
          changed: true,
          transition: prepared.transition,
          effectiveState: prepared.effectiveState,
          certificate: Object.freeze(cloneCertificate(prepared.certificate)),
        });
      }
      if (
        result.outcome !== 'conflict'
        || result.latestProfileEpoch !== profileEpoch
      ) {
        throw new Error('FEED_TOPOLOGY_PERSISTED_CERTIFICATE_CAS_RESULT_INVALID');
      }
      stored = Object.freeze({
        found: result.checkpoint !== null,
        profileEpoch,
        checkpoint: result.checkpoint,
      });
    }
    throw new Error('FEED_TOPOLOGY_PERSISTED_CERTIFICATE_CONFLICT_EXHAUSTED');
  }

  async _resolveAdmittedProfileEpoch() {
    const lifecycle = await this._readLifecycle();
    const profileEpoch = resolveProfileResetGeneration(lifecycle);
    await this._assertWriteAdmission({ expectedResetId: profileEpoch });
    return profileEpoch;
  }
}

export function createFeedTopologyPersistentCertificationService(options) {
  return new FeedTopologyPersistentCertificationService(options);
}

export default FeedTopologyPersistentCertificationService;
