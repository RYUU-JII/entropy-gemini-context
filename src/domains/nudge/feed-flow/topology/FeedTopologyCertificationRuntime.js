import {
  FEED_TOPOLOGY_CERTIFICATE_PERSISTENCE,
  FEED_TOPOLOGY_CERTIFICATE_STATES,
  buildFeedTopologyCertificateSurfaceKey,
  normalizeFeedTopologyCertificateSurface,
} from '../../../../platform/storage/model/FeedTopologyCertificateCheckpointContract.js';
import FeedLocalTopologyProbe from './FeedLocalTopologyProbe.js';
import { createRandomUuid } from '../../../../lib/randomUuid.js';
import FeedTopologyPersistenceClient from './FeedTopologyPersistenceClient.js';
import {
  readFeedFlowDiagnosticElapsedMs,
  recordFeedFlowDiagnosticEvent,
  startFeedFlowDiagnosticMeasure,
} from '../diagnostics/feedFlowDiagnosticState.js';
import {
  FEED_TOPOLOGY_CERTIFICATION_SNAPSHOT_VERSION,
  FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT,
  FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY,
  FEED_TOPOLOGY_OBSERVATION_OUTCOMES,
  buildFeedTopologyObservationFact,
  normalizeFeedTopologyLocalCertificateEvidence,
  resolveEffectiveFeedTopologyCertificateState,
} from './feedTopologyCertificationContracts.js';

export { FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT };

const CHECKPOINT_STATES = Object.freeze({
  INACTIVE: 'inactive',
  UNSUPPORTED: 'unsupported',
  RESTORING: 'restoring',
  OBSERVING: 'observing',
  UPDATING: 'updating',
  READY: 'ready',
  FAILED: 'failed',
});

function requireModuleMethod(owner, method, errorCode) {
  if (!owner || typeof owner[method] !== 'function') throw new Error(errorCode);
}

function defaultObservationIdFactory() {
  const value = createRandomUuid();
  if (typeof value !== 'string' || !value) {
    throw new Error('FEED_TOPOLOGY_OBSERVATION_ID_FACTORY_UNAVAILABLE');
  }
  return `topology-${value.toLowerCase()}`;
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

function cloneSurface(surface) {
  if (!surface) return null;
  return {
    hostname: surface.hostname,
    profileId: surface.profileId,
    semanticSurfaceId: surface.semanticSurfaceId,
    surfaceMode: surface.surfaceMode,
    contentClass: surface.contentClass,
    candidateItemSelectors: surface.candidateItemSelectors,
  };
}

function buildPersistentSurface(surface) {
  return normalizeFeedTopologyCertificateSurface({
    hostname: surface?.hostname,
    profileId: surface?.profileId,
    semanticSurfaceId: surface?.semanticSurfaceId,
    surfaceMode: surface?.surfaceMode,
    contentClass: surface?.contentClass,
  });
}

function isEligibleSurface(surface) {
  return !!surface
    && typeof surface.hostname === 'string'
    && !!surface.hostname
    && typeof surface.profileId === 'string'
    && !!surface.profileId
    && typeof surface.semanticSurfaceId === 'string'
    && !!surface.semanticSurfaceId
    && surface.contentClass === 'feed'
    && (surface.surfaceMode === 'continuous' || surface.surfaceMode === 'paged');
}

function cloneProbeReadout(probe) {
  if (!probe) return null;
  return {
    contract: probe.contract,
    status: probe.status,
    reasons: Array.isArray(probe.reasons) ? [...probe.reasons] : [],
    fingerprint: probe.fingerprint || '',
    descriptor: probe.descriptor ? { ...probe.descriptor } : null,
    futureBranchCount: Math.max(0, Math.round(Number(probe.futureBranchCount) || 0)),
  };
}

function inspectMeasuredTopology({
  topologyProbe,
  surface,
  actuationContext,
  phase,
}) {
  const measurementStartedAt = startFeedFlowDiagnosticMeasure();
  let probe = null;
  try {
    probe = topologyProbe.inspect({
      surface,
      actuationContext,
    });
    return probe;
  } finally {
    recordFeedFlowDiagnosticEvent('topology_probe', {
      phase,
      status: probe?.status || 'invalid',
      surfaceMode: surface?.surfaceMode || 'unknown',
      candidateCount: Array.isArray(probe?.candidateItems)
        ? probe.candidateItems.length
        : 0,
      futureBranchCount: probe?.futureBranchCount || 0,
      durationMs: readFeedFlowDiagnosticElapsedMs(measurementStartedAt),
    });
  }
}

export class FeedTopologyCertificationRuntime {
  constructor({
    persistenceClient = new FeedTopologyPersistenceClient(),
    topologyProbe = new FeedLocalTopologyProbe(),
    now = () => Date.now(),
    observationIdFactory = defaultObservationIdFactory,
    onSnapshot = null,
  } = {}) {
    ['restoreSurface', 'commitObservation'].forEach((method) => {
      requireModuleMethod(
        persistenceClient,
        method,
        `FEED_TOPOLOGY_PERSISTENCE_CLIENT_METHOD_REQUIRED:${method}`,
      );
    });
    requireModuleMethod(
      topologyProbe,
      'inspect',
      'FEED_LOCAL_TOPOLOGY_PROBE_METHOD_REQUIRED:inspect',
    );
    if (typeof now !== 'function') {
      throw new Error('FEED_TOPOLOGY_CERTIFICATION_CLOCK_REQUIRED');
    }
    if (typeof observationIdFactory !== 'function') {
      throw new Error('FEED_TOPOLOGY_OBSERVATION_ID_FACTORY_REQUIRED');
    }
    if (onSnapshot !== null && typeof onSnapshot !== 'function') {
      throw new Error('FEED_TOPOLOGY_CERTIFICATION_SNAPSHOT_OBSERVER_INVALID');
    }
    this._persistenceClient = persistenceClient;
    this._topologyProbe = topologyProbe;
    this._now = now;
    this._observationIdFactory = observationIdFactory;
    this._onSnapshot = onSnapshot;
    this._persistenceTail = Promise.resolve();
    this._generation = 0;
    this._active = false;
    this._surface = null;
    this._persistentSurface = null;
    this._surfaceKey = '';
    this._certificate = null;
    this._checkpoint = this._createCheckpointState();
    this._latestLearnerSnapshot = null;
    this._latestProbe = null;
    this._liveFingerprint = '';
    this._liveStableSamples = 0;
    this._lastLiveProbeAt = null;
    this._submittedFacts = new Set();
    this._failure = null;
  }

  start({ surface } = {}) {
    if (this._active) throw new Error('FEED_TOPOLOGY_CERTIFICATION_ALREADY_ACTIVE');
    this._active = true;
    this._setSurface(surface);
    return this.getSnapshot();
  }

  setSurface(surface) {
    if (!this._active) {
      throw new Error('FEED_TOPOLOGY_CERTIFICATION_NOT_ACTIVE');
    }
    this._setSurface(surface);
    return this.getSnapshot();
  }

  stop() {
    this._generation += 1;
    this._active = false;
    this._surface = null;
    this._persistentSurface = null;
    this._surfaceKey = '';
    this._certificate = null;
    this._latestLearnerSnapshot = null;
    this._latestProbe = null;
    this._liveFingerprint = '';
    this._liveStableSamples = 0;
    this._lastLiveProbeAt = null;
    this._failure = null;
    this._checkpoint = this._createCheckpointState();
    return this.getSnapshot();
  }

  resetLiveVerification({ reason = 'lifecycle_reset' } = {}) {
    if (
      typeof reason !== 'string'
      || !/^[a-z0-9][a-z0-9_:-]{0,79}$/i.test(reason)
    ) {
      throw new Error('FEED_TOPOLOGY_LIVE_RESET_REASON_INVALID');
    }
    this._latestProbe = null;
    this._liveFingerprint = '';
    this._liveStableSamples = 0;
    this._lastLiveProbeAt = null;
    this._checkpoint.liveResetCount += 1;
    this._checkpoint.lastLiveResetReason = reason;
    if (
      this._active
      && this._checkpoint.state !== CHECKPOINT_STATES.RESTORING
      && this._checkpoint.state !== CHECKPOINT_STATES.FAILED
    ) {
      this._checkpoint.state = CHECKPOINT_STATES.OBSERVING;
    }
    this._publishSnapshot();
    return this.getSnapshot();
  }

  observe({
    learnerSnapshot = null,
    actuationContext = null,
    now = this._readNow(),
  } = {}) {
    if (!this._active || !this._surface || !isEligibleSurface(this._surface)) {
      return this.getSnapshot();
    }
    const observedAt = this._requireTime(now);
    this._latestLearnerSnapshot = learnerSnapshot && typeof learnerSnapshot === 'object'
      ? { ...learnerSnapshot }
      : null;
    const learnerState = learnerSnapshot?.state;
    if (learnerState === 'ready') {
      const learnerSampleCount = learnerSnapshot.sampleCount;
      if (!Number.isSafeInteger(learnerSampleCount) || learnerSampleCount < 0) {
        throw new Error('FEED_TOPOLOGY_OBSERVATION_LEARNER_SAMPLE_COUNT_INVALID');
      }
      // Expired proof must reacquire its three samples at the initial cadence,
      // even when this document has already submitted the same fingerprint.
      if (
        this._lastLiveProbeAt !== null
        && observedAt - this._lastLiveProbeAt
          > FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveProofTtlMs
      ) {
        this._liveFingerprint = '';
        this._liveStableSamples = 0;
      }
      const effectiveCertificateState = resolveEffectiveFeedTopologyCertificateState(
        this._certificate,
        { now: observedAt },
      );
      const currentSubmissionKey = this._liveFingerprint
        ? `${this._surfaceKey}:${
          FEED_TOPOLOGY_OBSERVATION_OUTCOMES.CORROBORATED
        }:${this._liveFingerprint}`
        : '';
      let minimumProbeIntervalMs = (
        FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.minimumLiveProbeIntervalMs
      );
      if (
        this._liveStableSamples
        >= FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveStabilitySamples
      ) {
        if (effectiveCertificateState === FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED) {
          minimumProbeIntervalMs = (
            FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.certifiedValidationIntervalMs
          );
        } else if (
          currentSubmissionKey
          && this._submittedFacts.has(currentSubmissionKey)
        ) {
          minimumProbeIntervalMs = (
            FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.shadowValidationIntervalMs
          );
        }
      }
      if (
        this._lastLiveProbeAt !== null
        && (
          observedAt < this._lastLiveProbeAt
          || observedAt - this._lastLiveProbeAt
            < minimumProbeIntervalMs
        )
      ) {
        return this.getSnapshot();
      }
      const probe = inspectMeasuredTopology({
        topologyProbe: this._topologyProbe,
        surface: this._surface,
        actuationContext,
        phase: 'local_certification',
      });
      this._lastLiveProbeAt = observedAt;
      this._latestProbe = cloneProbeReadout(probe);
      if (probe.status !== 'resolved') {
        this._liveFingerprint = '';
        this._liveStableSamples = 0;
        this._checkpoint.state = CHECKPOINT_STATES.OBSERVING;
        this._publishSnapshot();
        return this.getSnapshot();
      }
      if (probe.fingerprint === this._liveFingerprint) {
        this._liveStableSamples += 1;
      } else {
        this._liveFingerprint = probe.fingerprint;
        this._liveStableSamples = 1;
      }
      this._checkpoint.state = CHECKPOINT_STATES.OBSERVING;
      if (
        this._liveStableSamples
        >= FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveStabilitySamples
        // Known profiles can become ready before durable fact admission.
        && learnerSampleCount
          >= FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.minimumLearnerSampleCount
      ) {
        this._queueFactOnce({
          outcome: FEED_TOPOLOGY_OBSERVATION_OUTCOMES.CORROBORATED,
          fingerprint: probe.fingerprint,
          descriptor: probe.descriptor,
          learnerSnapshot,
          observedAt,
        });
      }
      this._publishSnapshot();
      return this.getSnapshot();
    }

    this._latestProbe = null;
    this._liveFingerprint = '';
    this._liveStableSamples = 0;
    this._lastLiveProbeAt = null;
    if (
      (learnerState === 'volatile' || learnerState === 'invalid')
      && this._certificate
    ) {
      this._queueFactOnce({
        outcome: FEED_TOPOLOGY_OBSERVATION_OUTCOMES.INVALIDATED,
        fingerprint: this._certificate.fingerprint,
        descriptor: this._certificate.descriptor,
        learnerSnapshot,
        observedAt,
      });
    }
    this._checkpoint.state = CHECKPOINT_STATES.OBSERVING;
    this._publishSnapshot();
    return this.getSnapshot();
  }

  getAuthorityEvidence({ now = this._readNow() } = {}) {
    const evaluatedAt = this._requireTime(now);
    const effectiveState = this._failure
      ? 'failed'
      : resolveEffectiveFeedTopologyCertificateState(
        this._certificate,
        { now: evaluatedAt },
      );
    const liveMatch = !!this._certificate
      && this._liveFingerprint === this._certificate.fingerprint
      && this._liveStableSamples
        >= FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveStabilitySamples
      && this._lastLiveProbeAt !== null
      && evaluatedAt >= this._lastLiveProbeAt
      && evaluatedAt - this._lastLiveProbeAt
        <= FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveProofTtlMs;
    return normalizeFeedTopologyLocalCertificateEvidence({
      contractVersion: FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT,
      state: liveMatch ? effectiveState : (
        effectiveState === FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED
          ? 'live_verification_pending'
          : effectiveState
      ),
      surface: this._persistentSurface ? { ...this._persistentSurface } : null,
      fingerprint: this._certificate?.fingerprint || '',
      descriptor: this._certificate?.descriptor
        ? { ...this._certificate.descriptor }
        : null,
      certificateRevision: this._certificate?.certificateRevision ?? null,
      certifiedAt: this._certificate?.certifiedAt || 0,
      expiresAt: this._certificate?.expiresAt || 0,
      liveFingerprint: this._liveFingerprint,
      liveStableSamples: this._liveStableSamples,
      checkpointStateRevision: this._checkpoint.stateRevision,
    });
  }

  getActuationTopology(actuationContext = null, {
    now = this._readNow(),
  } = {}) {
    const evidence = this.getAuthorityEvidence({ now });
    if (evidence.state !== FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED) return null;
    const probe = inspectMeasuredTopology({
      topologyProbe: this._topologyProbe,
      surface: this._surface,
      actuationContext,
      phase: 'local_actuation_recheck',
    });
    if (
      probe.status !== 'resolved'
      || probe.fingerprint !== evidence.fingerprint
    ) return null;
    return probe;
  }

  async waitForPersistence() {
    await this._persistenceTail;
    return this.getSnapshot();
  }

  getSnapshot() {
    const evidence = this.getAuthorityEvidence({
      now: this._active ? this._readNow() : 0,
    });
    return {
      version: FEED_TOPOLOGY_CERTIFICATION_SNAPSHOT_VERSION,
      mode: 'local_persisted_shadow',
      persistence: FEED_TOPOLOGY_CERTIFICATE_PERSISTENCE,
      active: this._active,
      state: this._active ? evidence.state : CHECKPOINT_STATES.INACTIVE,
      surface: this._persistentSurface ? { ...this._persistentSurface } : null,
      surfaceKey: this._surfaceKey,
      checkpoint: {
        ...this._checkpoint,
        failure: this._failure ? 'feed_topology_certificate_persistence_failure' : null,
      },
      certificate: cloneCertificate(this._certificate),
      live: {
        fingerprint: this._liveFingerprint,
        stableSamples: this._liveStableSamples,
        requiredStableSamples: FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveStabilitySamples,
        lastProbeAt: this._lastLiveProbeAt,
        proofExpiresAt: this._lastLiveProbeAt === null
          ? 0
          : this._lastLiveProbeAt
            + FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveProofTtlMs,
        probe: cloneProbeReadout(this._latestProbe),
      },
      authorityEvidence: evidence,
    };
  }

  getModules() {
    return {
      persistenceClient: this._persistenceClient,
      topologyProbe: this._topologyProbe,
    };
  }

  _setSurface(surface) {
    this._generation += 1;
    this._surface = surface && typeof surface === 'object' ? cloneSurface(surface) : null;
    this._persistentSurface = null;
    this._surfaceKey = '';
    this._certificate = null;
    this._latestLearnerSnapshot = null;
    this._latestProbe = null;
    this._liveFingerprint = '';
    this._liveStableSamples = 0;
    this._lastLiveProbeAt = null;
    this._failure = null;
    this._checkpoint = this._createCheckpointState();
    if (!isEligibleSurface(this._surface)) {
      this._checkpoint.state = CHECKPOINT_STATES.UNSUPPORTED;
      this._publishSnapshot();
      return;
    }
    this._persistentSurface = buildPersistentSurface(this._surface);
    this._surfaceKey = buildFeedTopologyCertificateSurfaceKey(
      this._persistentSurface,
    );
    this._checkpoint.state = CHECKPOINT_STATES.RESTORING;
    const generation = this._generation;
    this._queuePersistenceOperation(async () => {
      const result = await this._persistenceClient.restoreSurface(
        this._persistentSurface,
      );
      if (!this._active || generation !== this._generation) return;
      this._certificate = cloneCertificate(result.certificate);
      this._checkpoint.stateRevision = result.checkpointStateRevision;
      this._checkpoint.restoreCount += 1;
      this._checkpoint.state = CHECKPOINT_STATES.READY;
      this._checkpoint.failureCount = 0;
      this._failure = null;
    }, generation);
  }

  _queueFactOnce({
    outcome,
    fingerprint,
    descriptor,
    learnerSnapshot,
    observedAt,
  }) {
    const submissionKey = `${this._surfaceKey}:${outcome}:${fingerprint}`;
    if (this._submittedFacts.has(submissionKey)) return;
    const observationId = this._observationIdFactory();
    const fact = buildFeedTopologyObservationFact({
      surface: this._persistentSurface,
      observationId,
      observedAt,
      outcome,
      fingerprint,
      descriptor,
      learnerSnapshot,
    });
    this._submittedFacts.add(submissionKey);
    const generation = this._generation;
    this._queuePersistenceOperation(async () => {
      this._checkpoint.state = CHECKPOINT_STATES.UPDATING;
      const result = await this._persistenceClient.commitObservation(fact);
      if (!this._active || generation !== this._generation) return;
      this._certificate = cloneCertificate(result.certificate);
      this._checkpoint.stateRevision = result.checkpointStateRevision;
      this._checkpoint.commitCount += result.changed ? 1 : 0;
      this._checkpoint.conflictCount += result.conflictCount;
      this._checkpoint.lastTransition = result.transition;
      this._checkpoint.state = CHECKPOINT_STATES.READY;
      this._failure = null;
    }, generation, {
      onFailure: () => {
        this._submittedFacts.delete(submissionKey);
      },
    });
  }

  _queuePersistenceOperation(operation, generation, {
    onFailure = null,
  } = {}) {
    this._checkpoint.pendingOperationCount += 1;
    const run = async () => {
      try {
        await operation();
      } catch (error) {
        onFailure?.(error);
        if (this._active && generation === this._generation) {
          this._checkpoint.state = CHECKPOINT_STATES.FAILED;
          this._checkpoint.failureCount += 1;
          this._failure = error;
        }
      } finally {
        if (this._active && generation === this._generation) {
          this._checkpoint.pendingOperationCount = Math.max(
            0,
            this._checkpoint.pendingOperationCount - 1,
          );
          this._publishSnapshot();
        }
      }
    };
    const queued = this._persistenceTail.then(run, run);
    this._persistenceTail = queued;
    return queued;
  }

  _createCheckpointState() {
    return {
      state: CHECKPOINT_STATES.INACTIVE,
      stateRevision: null,
      pendingOperationCount: 0,
      restoreCount: 0,
      commitCount: 0,
      conflictCount: 0,
      failureCount: 0,
      lastTransition: '',
      liveResetCount: 0,
      lastLiveResetReason: '',
    };
  }

  _readNow() {
    return this._requireTime(Math.round(Number(this._now())));
  }

  _requireTime(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('FEED_TOPOLOGY_CERTIFICATION_CLOCK_INVALID');
    }
    return value;
  }

  _publishSnapshot() {
    if (!this._onSnapshot) return;
    this._onSnapshot(this.getSnapshot());
  }
}

export default FeedTopologyCertificationRuntime;
