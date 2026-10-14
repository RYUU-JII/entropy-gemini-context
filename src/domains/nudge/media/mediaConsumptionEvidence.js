import {
  PAGE_MEDIA_ACTIVITY_SNAPSHOT_VERSION,
} from './pageMediaActivityContract.js';

export const MEDIA_CONSUMPTION_EVIDENCE_VERSION = 1;
export const MEDIA_CONSUMPTION_EVIDENCE_KIND = 'media_consumption';

const DEFAULT_EVIDENCE_TTL_MS = 2_000;

function normalizeNow(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function normalizeCount(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function requirePageMediaActivitySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('MEDIA_CONSUMPTION_ACTIVITY_SNAPSHOT_REQUIRED');
  }
  if (snapshot.version !== PAGE_MEDIA_ACTIVITY_SNAPSHOT_VERSION) {
    throw new Error(`MEDIA_CONSUMPTION_ACTIVITY_VERSION_INVALID:${String(snapshot.version)}`);
  }
  if (snapshot.source !== 'page_media_activity') {
    throw new Error(`MEDIA_CONSUMPTION_ACTIVITY_SOURCE_INVALID:${String(snapshot.source)}`);
  }
  return snapshot;
}

export function projectPageMediaConsumptionEvidence(snapshot, {
  now = snapshot?.observedAt,
  ttlMs = DEFAULT_EVIDENCE_TTL_MS,
} = {}) {
  const source = requirePageMediaActivitySnapshot(snapshot);
  const observedAt = normalizeNow(now, 'MEDIA_CONSUMPTION_EVIDENCE_NOW_INVALID');
  const sourceObservedAt = normalizeNow(
    source.observedAt,
    'MEDIA_CONSUMPTION_SOURCE_OBSERVED_AT_INVALID',
  );
  if (sourceObservedAt > observedAt) {
    throw new Error('MEDIA_CONSUMPTION_SOURCE_FROM_FUTURE');
  }
  const normalizedTtlMs = normalizeCount(
    ttlMs,
    'MEDIA_CONSUMPTION_EVIDENCE_TTL_INVALID',
  );
  const activeSince = normalizeNow(
    source.activeSince,
    'MEDIA_CONSUMPTION_ACTIVE_SINCE_INVALID',
  );
  if (activeSince > observedAt) {
    throw new Error('MEDIA_CONSUMPTION_ACTIVE_SINCE_FROM_FUTURE');
  }
  const audibleCandidateCount = normalizeCount(
    source.audibleCandidateCount,
    'MEDIA_CONSUMPTION_AUDIBLE_COUNT_INVALID',
  );
  const playingCount = normalizeCount(
    source.playingCount,
    'MEDIA_CONSUMPTION_PLAYING_COUNT_INVALID',
  );
  return Object.freeze({
    version: MEDIA_CONSUMPTION_EVIDENCE_VERSION,
    kind: MEDIA_CONSUMPTION_EVIDENCE_KIND,
    source: source.source,
    evidenceRevision: normalizeCount(
      source.revision,
      'MEDIA_CONSUMPTION_EVIDENCE_REVISION_INVALID',
    ),
    observedAt: sourceObservedAt,
    validUntil: sourceObservedAt + normalizedTtlMs,
    activeSince: audibleCandidateCount > 0 ? activeSince : 0,
    sustainedPlaybackMs: audibleCandidateCount > 0 && activeSince > 0
      ? Math.max(0, sourceObservedAt - activeSince)
      : 0,
    playing: playingCount > 0,
    audibleCandidate: audibleCandidateCount > 0,
    mediaElementCount: normalizeCount(
      source.mediaElementCount,
      'MEDIA_CONSUMPTION_MEDIA_COUNT_INVALID',
    ),
    audioElementCount: normalizeCount(
      source.audioElementCount,
      'MEDIA_CONSUMPTION_AUDIO_COUNT_INVALID',
    ),
    videoElementCount: normalizeCount(
      source.videoElementCount,
      'MEDIA_CONSUMPTION_VIDEO_COUNT_INVALID',
    ),
    playingCount,
    audibleCandidateCount,
  });
}

export default projectPageMediaConsumptionEvidence;
