import videoElementObserver from '../video/VideoElementObserver.js';
import {
  isMediaObservationExcludedNode,
  isTabMediaElement,
} from './pageMediaElements.js';
import {
  PAGE_MEDIA_ACTIVITY_SNAPSHOT_VERSION,
} from './pageMediaActivityContract.js';

export { PAGE_MEDIA_ACTIVITY_SNAPSHOT_VERSION } from './pageMediaActivityContract.js';

const MEDIA_ACTIVITY_EVENTS = Object.freeze([
  'canplay',
  'emptied',
  'ended',
  'loadeddata',
  'pause',
  'play',
  'playing',
  'volumechange',
]);

function normalizeNow(value, label = 'PAGE_MEDIA_ACTIVITY_NOW_INVALID') {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function readFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isConnectedMediaElement(element, documentRef) {
  if (!isTabMediaElement(element) || element.ownerDocument !== documentRef) return false;
  if (typeof element.isConnected === 'boolean') return element.isConnected;
  return documentRef?.contains?.(element) === true;
}

export function isPlayingPageMediaElement(element) {
  return isTabMediaElement(element)
    && element.paused === false
    && element.ended !== true;
}

export function isAudiblePageMediaCandidate(element) {
  if (!isPlayingPageMediaElement(element) || element.muted === true) return false;
  const volume = readFiniteNumber(element.volume);
  if (volume !== null && volume <= 0.01) return false;
  const readyState = readFiniteNumber(element.readyState);
  if (readyState !== null && readyState < 2) return false;
  return true;
}

function summarizeMedia(elements, predicate) {
  return elements.reduce((count, element) => count + (predicate(element) ? 1 : 0), 0);
}

function buildSemanticSignature(snapshot) {
  return JSON.stringify([
    snapshot.mediaElementCount,
    snapshot.audioElementCount,
    snapshot.videoElementCount,
    snapshot.playingCount,
    snapshot.audibleCandidateCount,
    snapshot.activeSince,
  ]);
}

function freezeSnapshot(snapshot) {
  return Object.freeze({ ...snapshot });
}

export class PageMediaActivityObserver {
  constructor({
    documentRef = typeof document !== 'undefined' ? document : null,
    mediaMutationOwner = videoElementObserver,
    now = () => Date.now(),
  } = {}) {
    if (
      !mediaMutationOwner
      || typeof mediaMutationOwner.subscribeMediaMutations !== 'function'
      || typeof mediaMutationOwner.getMediaSnapshot !== 'function'
      || typeof mediaMutationOwner.reconcileExistingVideos !== 'function'
    ) {
      throw new Error('PAGE_MEDIA_ACTIVITY_MUTATION_OWNER_REQUIRED');
    }
    if (typeof now !== 'function') {
      throw new Error('PAGE_MEDIA_ACTIVITY_CLOCK_REQUIRED');
    }
    this._document = documentRef;
    this._mediaMutationOwner = mediaMutationOwner;
    this._now = now;
    this._subscribers = new Map();
    this._trackedMedia = new Map();
    this._mutationUnsubscribe = null;
    this._activeSince = 0;
    this._lastTransitionAt = 0;
    this._revision = 0;
    this._lastSemanticSignature = '';
    this._nextSubscriberId = 1;
  }

  subscribe({
    onSnapshot,
    emitCurrent = true,
    debugLabel = 'PageMediaActivityObserver.subscriber',
  } = {}) {
    if (typeof onSnapshot !== 'function') {
      throw new Error('PAGE_MEDIA_ACTIVITY_SUBSCRIBER_REQUIRED');
    }
    const subscriberId = this._nextSubscriberId;
    this._nextSubscriberId += 1;
    const subscriber = {
      id: subscriberId,
      onSnapshot,
      debugLabel: String(debugLabel || 'PageMediaActivityObserver.subscriber'),
    };
    const firstSubscriber = this._subscribers.size === 0;
    this._subscribers.set(subscriberId, subscriber);
    try {
      if (firstSubscriber) this._start();
      if (emitCurrent) onSnapshot(this.getSnapshot());
    } catch (error) {
      this._subscribers.delete(subscriberId);
      if (this._subscribers.size === 0) this._stop();
      throw error;
    }
    return () => this._unsubscribe(subscriberId);
  }

  getSnapshot({ now = this._now() } = {}) {
    const observedAt = normalizeNow(now);
    this._pruneDisconnectedMedia();
    return this._buildSnapshot(observedAt);
  }

  reconcile({ reason = 'manual_reconcile' } = {}) {
    if (this._subscribers.size === 0) {
      throw new Error('PAGE_MEDIA_ACTIVITY_RECONCILE_WITHOUT_SUBSCRIBER');
    }
    this._reconcileDocument();
    return this._syncAndNotify(reason);
  }

  getDebugSnapshot() {
    return Object.freeze({
      active: this._subscribers.size > 0,
      subscriberCount: this._subscribers.size,
      trackedMediaCount: this._trackedMedia.size,
      revision: this._revision,
      activeSince: this._activeSince,
      lastTransitionAt: this._lastTransitionAt,
    });
  }

  _start() {
    // A failed initial subscription may retain exact teardown ownership. Finish
    // that teardown before acquiring another observation lease.
    if (this._mutationUnsubscribe || this._trackedMedia.size > 0) this._stop();
    if (!this._document?.documentElement) {
      throw new Error('PAGE_MEDIA_ACTIVITY_DOCUMENT_REQUIRED');
    }
    this._mutationUnsubscribe = this._mediaMutationOwner.subscribeMediaMutations({
      onMutation: (payload) => this._handleMutationPayload(payload),
      debugLabel: 'PageMediaActivityObserver.observer',
    });
    this._reconcileDocument({ reconcileVideos: false });
    this._syncState('start');
  }

  _stop() {
    const errors = [];
    if (typeof this._mutationUnsubscribe === 'function') {
      const unsubscribe = this._mutationUnsubscribe;
      try {
        unsubscribe();
        this._mutationUnsubscribe = null;
      } catch (error) {
        errors.push(error);
      }
    }
    Array.from(this._trackedMedia.keys()).forEach((element) => {
      try {
        this._detachMediaElement(element);
      } catch (error) {
        errors.push(error);
      }
    });
    if (errors.length > 0) {
      const failure = new Error('PAGE_MEDIA_ACTIVITY_STOP_FAILED');
      failure.causes = errors;
      throw failure;
    }
    this._activeSince = 0;
    this._lastTransitionAt = 0;
    this._revision = 0;
    this._lastSemanticSignature = '';
  }

  _unsubscribe(subscriberId) {
    if (!this._subscribers.has(subscriberId)) return false;
    if (this._subscribers.size === 1) this._stop();
    this._subscribers.delete(subscriberId);
    return true;
  }

  _reconcileDocument({ reconcileVideos = true } = {}) {
    if (reconcileVideos) this._mediaMutationOwner.reconcileExistingVideos();
    const { videos, audio } = this._mediaMutationOwner.getMediaSnapshot();
    videos.forEach((element) => this._attachMediaElement(element));
    audio.forEach((element) => this._attachMediaElement(element));
    this._pruneDisconnectedMedia();
  }

  _handleMutationPayload({
    removedNodes,
    observedVideos,
    observedAudio,
  }) {
    observedVideos.forEach((element) => this._attachMediaElement(element));
    observedAudio.forEach((element) => this._attachMediaElement(element));
    if (removedNodes.length > 0) {
      this._pruneDisconnectedMedia();
    }
    this._syncAndNotify('media_mutation');
  }

  _attachMediaElement(element) {
    if (
      !isConnectedMediaElement(element, this._document)
      || isMediaObservationExcludedNode(element)
      || this._trackedMedia.has(element)
    ) {
      return false;
    }
    const handleActivity = () => this._syncAndNotify('media_event');
    MEDIA_ACTIVITY_EVENTS.forEach((eventName) => {
      element.addEventListener(eventName, handleActivity, { passive: true });
    });
    this._trackedMedia.set(element, handleActivity);
    return true;
  }

  _detachMediaElement(element) {
    const handleActivity = this._trackedMedia.get(element);
    if (!handleActivity) return false;
    MEDIA_ACTIVITY_EVENTS.forEach((eventName) => {
      element.removeEventListener(eventName, handleActivity);
    });
    this._trackedMedia.delete(element);
    return true;
  }

  _pruneDisconnectedMedia() {
    Array.from(this._trackedMedia.keys()).forEach((element) => {
      if (!isConnectedMediaElement(element, this._document)) this._detachMediaElement(element);
    });
  }

  _buildSnapshot(observedAt) {
    const media = Array.from(this._trackedMedia.keys());
    const playingCount = summarizeMedia(media, isPlayingPageMediaElement);
    const audibleCandidateCount = summarizeMedia(media, isAudiblePageMediaCandidate);
    const activeSince = audibleCandidateCount > 0 ? this._activeSince : 0;
    return freezeSnapshot({
      version: PAGE_MEDIA_ACTIVITY_SNAPSHOT_VERSION,
      source: 'page_media_activity',
      revision: this._revision,
      observedAt,
      lastTransitionAt: this._lastTransitionAt,
      activeSince,
      sustainedPlaybackMs: activeSince > 0
        ? Math.max(0, observedAt - activeSince)
        : 0,
      playing: playingCount > 0,
      audibleCandidate: audibleCandidateCount > 0,
      mediaElementCount: media.length,
      audioElementCount: media.filter(
        (element) => String(element.tagName || '').toLowerCase() === 'audio',
      ).length,
      videoElementCount: media.filter(
        (element) => String(element.tagName || '').toLowerCase() === 'video',
      ).length,
      playingCount,
      audibleCandidateCount,
    });
  }

  _syncState(reason) {
    this._pruneDisconnectedMedia();
    const now = normalizeNow(this._now());
    const media = Array.from(this._trackedMedia.keys());
    const audibleCandidateCount = summarizeMedia(media, isAudiblePageMediaCandidate);
    if (audibleCandidateCount > 0 && this._activeSince <= 0) {
      this._activeSince = now;
    } else if (audibleCandidateCount === 0) {
      this._activeSince = 0;
    }
    const nextSnapshot = this._buildSnapshot(now);
    const semanticSignature = buildSemanticSignature(nextSnapshot);
    if (semanticSignature === this._lastSemanticSignature) {
      return { changed: false, reason, snapshot: nextSnapshot };
    }
    this._lastSemanticSignature = semanticSignature;
    this._revision += 1;
    this._lastTransitionAt = now;
    return {
      changed: true,
      reason,
      snapshot: this._buildSnapshot(now),
    };
  }

  _syncAndNotify(reason) {
    const result = this._syncState(reason);
    if (!result.changed) return result.snapshot;
    this._subscribers.forEach((subscriber) => {
      try {
        subscriber.onSnapshot(result.snapshot);
      } catch (error) {
        console.warn?.('[PageMediaActivityObserver] subscriber failed', {
          debugLabel: subscriber.debugLabel,
          error: String(error?.message || error || 'PAGE_MEDIA_ACTIVITY_SUBSCRIBER_FAILED'),
        });
      }
    });
    return result.snapshot;
  }
}

export const pageMediaActivityObserver = new PageMediaActivityObserver();

export default pageMediaActivityObserver;
