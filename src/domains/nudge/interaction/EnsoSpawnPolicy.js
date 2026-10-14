import sharedInterventionAdmissionRuntime from '../runtime/interventionAdmissionClient.js';
import { createInterventionActivationTrace, recordInterventionLifecycleEvent } from '../runtime/interventionLifecycleDiagnostics.js';
import {
  ENSO_SPAWN_SOURCES,
  ENSO_SPAWN_SOURCE_SET,
} from './ensoSpawnSources.js';

export {
  ENSO_SPAWN_SOURCES,
};

export const ENSO_SPAWN_EPISODE_PHASES = Object.freeze({
  RESERVED: 'reserved',
  PRESENTED: 'presented',
});

function normalizeNow(value = Date.now()) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`ENSO_SPAWN_POLICY_NOW_INVALID:${String(value)}`);
  }
  return numeric;
}

function requireSource(value) {
  if (!ENSO_SPAWN_SOURCE_SET.has(value)) {
    throw new Error(`ENSO_SPAWN_POLICY_SOURCE_INVALID:${String(value)}`);
  }
  return value;
}

function resolveAdmissionRuntime(value) {
  if (value === null || value?.enabled === false) return null;
  if (
    !value
    || value.enabled !== true
    || typeof value.reserveEnso !== 'function'
    || typeof value.canCompletePrepared !== 'function'
    || typeof value.present !== 'function'
    || typeof value.abort !== 'function'
    || typeof value.release !== 'function'
    || typeof value.getSnapshot !== 'function'
    || typeof value.refreshEnsoCadence !== 'function'
    || typeof value.cancelPending !== 'function'
  ) {
    throw new Error('ENSO_SPAWN_POLICY_ADMISSION_RUNTIME_INVALID');
  }
  return value;
}

function summarizeEpisode(episode) {
  if (!episode) return null;
  return Object.freeze({
    source: episode.source,
    phase: episode.phase,
    reservedAt: episode.reservedAt,
    presentedAt: episode.presentedAt,
    endpointAttachedAt: episode.endpointAttachedAt,
    sharedAdmission: episode.interventionLease !== null,
  });
}

/** Content-local source/permit ownership. Background admission alone owns consumption cadence. */
export class EnsoSpawnPolicy {
  constructor({
    admissionRuntime = null,
  } = {}) {
    this._admissionRuntime = resolveAdmissionRuntime(admissionRuntime);
    this._nextPermitId = 1;
    // Presentation identity survives activation resets and same-timestamp commits.
    // Consumers may reset their own admission memory, never observed evidence.
    this._presentationRevision = 0;
    this._hardReset();
  }

  _hardReset() {
    this._enabled = false;
    this._resetPending = false;
    this._activeSources = new Set();
    this._sourcePolicies = new Map();
    this._sessionStartedAt = 0;
    this._lastPresentedAt = 0;
    this._lastPresentedSource = null;
    this._activeEpisode = null;
  }

  configure({
    source,
    enabled = true,
    protectionContext,
  } = {}, { now = Date.now() } = {}) {
    const normalizedSource = requireSource(source);
    const normalizedNow = normalizeNow(now);
    const nextEnabled = enabled === true;
    if (!nextEnabled) {
      this.deactivate(normalizedSource);
      return this.getSnapshot({ now: normalizedNow });
    }
    if (!this._enabled && this._activeEpisode) {
      throw new Error('ENSO_SPAWN_POLICY_REACTIVATE_WITH_EPISODE');
    }

    if (this._admissionRuntime !== null) {
      void this._admissionRuntime.refreshEnsoCadence().catch(() => { /* transport owner reports the failure */ });
    }
    const wasEnabled = this._enabled;
    const existingSourcePolicy = this._sourcePolicies.get(normalizedSource);
    const lifecycleTrace = existingSourcePolicy && protectionContext === undefined
      ? existingSourcePolicy.lifecycleTrace
      : createInterventionActivationTrace({ protectionContext });
    if (lifecycleTrace !== existingSourcePolicy?.lifecycleTrace) {
      recordInterventionLifecycleEvent('activation_configured', { ...lifecycleTrace, kind: 'enso_gate', source: normalizedSource });
    }
    this._activeSources.add(normalizedSource);
    this._sourcePolicies.set(normalizedSource, {
      activatedAt: existingSourcePolicy?.activatedAt ?? normalizedNow,
      lifecycleTrace,
    });
    this._enabled = true;
    this._resetPending = false;
    if (!wasEnabled) {
      this._sessionStartedAt = normalizedNow;
      this._lastPresentedAt = 0;
      this._lastPresentedSource = null;
    }
    return this.getSnapshot({
      now: normalizedNow,
      source: normalizedSource,
    });
  }

  deactivate(source) {
    const normalizedSource = requireSource(source);
    const sourcePolicy = this._sourcePolicies.get(normalizedSource);
    if (sourcePolicy) recordInterventionLifecycleEvent('activation_stopping', {
      ...sourcePolicy.lifecycleTrace, kind: 'enso_gate', source: normalizedSource,
    });
    if (this._admissionRuntime !== null) {
      this._admissionRuntime.cancelPending({ kind: 'enso_gate', source: normalizedSource });
    }
    this._activeSources.delete(normalizedSource);
    this._sourcePolicies.delete(normalizedSource);
    if (this._activeSources.size > 0) return true;
    this._enabled = false;
    if (this._activeEpisode) {
      this._resetPending = true;
      return true;
    }
    this._hardReset();
    return true;
  }

  evaluate({
    source,
    permit = null,
    now = Date.now(),
  } = {}) {
    const normalizedSource = requireSource(source);
    const normalizedNow = normalizeNow(now);
    const snapshot = this.getSnapshot({
      now: normalizedNow,
      source: normalizedSource,
    });

    if (!this._enabled) {
      return Object.freeze({
        ...snapshot,
        source: normalizedSource,
        allowed: false,
        reason: 'policy_inactive',
      });
    }

    if (!this._activeSources.has(normalizedSource)) {
      return Object.freeze({
        ...snapshot,
        source: normalizedSource,
        allowed: false,
        reason: 'source_inactive',
      });
    }

    if (permit !== null) {
      const episode = this._activeEpisode;
      if (!episode || episode.permit !== permit || episode.source !== normalizedSource) {
        return Object.freeze({
          ...snapshot,
          source: normalizedSource,
          allowed: false,
          reason: 'permit_invalid',
        });
      }
      return Object.freeze({
        ...snapshot,
        source: normalizedSource,
        allowed: true,
        reason: episode.phase === ENSO_SPAWN_EPISODE_PHASES.PRESENTED
          ? 'episode_continuation'
          : 'episode_reserved',
      });
    }

    if (this._activeEpisode) {
      return Object.freeze({
        ...snapshot,
        source: normalizedSource,
        allowed: false,
        reason: 'episode_active',
      });
    }
    return Object.freeze({
      ...snapshot,
      source: normalizedSource,
      allowed: true,
      reason: 'available',
    });
  }

  reserve({
    source,
    manual = false,
    now = Date.now(),
  } = {}) {
    const normalizedNow = normalizeNow(now);
    const decision = this.evaluate({ source, now: normalizedNow });
    if (!decision.allowed) {
      return Object.freeze({ ok: false, permit: null, decision });
    }
    const sharedAdmission = this._admissionRuntime
      ? this._admissionRuntime.reserveEnso({
          source: decision.source,
          requestSerial: this._nextPermitId,
          lifecycleTrace: this._sourcePolicies.get(decision.source).lifecycleTrace,
          manual,
          now: normalizedNow,
        })
      : null;
    if (sharedAdmission && sharedAdmission.accepted !== true) {
      return Object.freeze({
        ok: false,
        permit: null,
        decision: Object.freeze({
          ...decision,
          allowed: false,
          reason: `shared_admission_${sharedAdmission.decision?.reason || 'rejected'}`,
          sharedAdmission: sharedAdmission.decision || null,
        }),
      });
    }
    const permit = Object.freeze({
      version: 1,
      id: this._nextPermitId,
      source: decision.source,
    });
    this._nextPermitId += 1;
    this._activeEpisode = {
      permit,
      source: decision.source,
      phase: ENSO_SPAWN_EPISODE_PHASES.RESERVED,
      reservedAt: normalizedNow,
      presentedAt: 0,
      endpointAttachedAt: 0,
      interventionLease: sharedAdmission?.lease || null,
    };
    return Object.freeze({
      ok: true,
      permit,
      decision: this.evaluate({
        source: decision.source,
        permit,
        now: normalizedNow,
      }),
    });
  }

  canCompletePreparedFeedReservation() {
    if (this._activeEpisode || !this._enabled || this._admissionRuntime === null) return false;
    return this._admissionRuntime.canCompletePrepared({
      kind: 'enso_gate', source: ENSO_SPAWN_SOURCES.FEED_HORIZON, manual: false,
    });
  }

  attachEndpoint(permit, { now = Date.now() } = {}) {
    const episode = this._activeEpisode;
    if (!episode || episode.permit !== permit || episode.source !== ENSO_SPAWN_SOURCES.FEED_HORIZON) {
      throw new Error('ENSO_SPAWN_POLICY_ENDPOINT_PERMIT_INVALID');
    }
    if (episode.endpointAttachedAt) return true;
    const attachedAt = normalizeNow(now);
    if (episode.interventionLease && this._admissionRuntime.attachEndpoint(episode.interventionLease) !== true) {
      throw new Error('ENSO_SPAWN_POLICY_ENDPOINT_NOT_ACKNOWLEDGED');
    }
    episode.endpointAttachedAt = attachedAt;
    return true;
  }

  commit(permit, { now = Date.now() } = {}) {
    const normalizedNow = normalizeNow(now);
    const episode = this._activeEpisode;
    if (!episode || episode.permit !== permit) {
      throw new Error('ENSO_SPAWN_POLICY_COMMIT_PERMIT_INVALID');
    }
    if (!this._enabled) {
      throw new Error('ENSO_SPAWN_POLICY_COMMIT_WHILE_INACTIVE');
    }
    if (!this._activeSources.has(episode.source)) {
      throw new Error('ENSO_SPAWN_POLICY_COMMIT_SOURCE_INACTIVE');
    }
    if (episode.phase === ENSO_SPAWN_EPISODE_PHASES.PRESENTED) {
      return Object.freeze({
        ok: true,
        committedNow: false,
        snapshot: this.getSnapshot({
          now: normalizedNow,
          source: episode.source,
        }),
      });
    }
    if (this._presentationRevision >= Number.MAX_SAFE_INTEGER) {
      throw new Error('ENSO_SPAWN_POLICY_PRESENTATION_REVISION_EXHAUSTED');
    }
    if (episode.interventionLease) {
      this._admissionRuntime.present(episode.interventionLease, {
        now: normalizedNow,
      });
    }
    episode.phase = ENSO_SPAWN_EPISODE_PHASES.PRESENTED;
    this._presentationRevision += 1;
    episode.presentedAt = normalizedNow;
    this._lastPresentedAt = normalizedNow;
    this._lastPresentedSource = episode.source;
    return Object.freeze({
      ok: true,
      committedNow: true,
      snapshot: this.getSnapshot({
        now: normalizedNow,
        source: episode.source,
      }),
    });
  }

  release(permit) {
    const episode = this._activeEpisode;
    if (!episode || episode.permit !== permit) return false;
    if (episode.interventionLease) {
      if (episode.phase === ENSO_SPAWN_EPISODE_PHASES.PRESENTED) {
        this._admissionRuntime.release(episode.interventionLease);
      } else {
        this._admissionRuntime.abort(episode.interventionLease);
      }
    }
    this._activeEpisode = null;
    if (this._resetPending) this._hardReset();
    return true;
  }

  inspectPermit(permit) {
    const episode = this._activeEpisode;
    const valid = !!episode && episode.permit === permit;
    return Object.freeze({
      valid,
      source: valid ? episode.source : null,
      phase: valid ? episode.phase : null,
      committed: valid && episode.phase === ENSO_SPAWN_EPISODE_PHASES.PRESENTED,
      endpointAttachedAt: valid ? episode.endpointAttachedAt : 0,
      interventionLease: valid ? episode.interventionLease : null,
    });
  }

  getSnapshot({ now = Date.now(), source = null } = {}) {
    const normalizedNow = normalizeNow(now);
    const normalizedSource = source === null ? null : requireSource(source);
    const sourcePolicy = normalizedSource === null
      ? null
      : this._sourcePolicies.get(normalizedSource) || null;
    return Object.freeze({
      version: 3,
      presentationRevision: this._presentationRevision,
      enabled: this._enabled,
      activeSources: Object.freeze(Array.from(this._activeSources)),
      source: normalizedSource,
      sessionStartedAt: this._sessionStartedAt,
      lastPresentedAt: this._lastPresentedAt,
      lastPresentedSource: this._lastPresentedSource,
      sourceActivatedAt: sourcePolicy?.activatedAt ?? 0,
      activeEpisode: summarizeEpisode(this._activeEpisode),
      admissionTransport: this._admissionRuntime === null ? null : this._admissionRuntime.getSnapshot(),
    });
  }
}

export const ensoSpawnPolicy = new EnsoSpawnPolicy({
  admissionRuntime: sharedInterventionAdmissionRuntime,
});

export default ensoSpawnPolicy;
