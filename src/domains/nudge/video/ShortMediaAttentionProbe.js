const SHORT_MEDIA_MAX_DURATION_SEC = 180;
const MIN_INITIAL_REPORT_MS = 6000;
const REPORT_CHUNK_MS = 10000;
const MAX_MEDIA_DELTA_SEC = 2.5;
const MAX_WALL_DELTA_MS = 3000;
const MIN_VISIBLE_RATIO = 0.45;

function isVideoElement(value) {
  return typeof HTMLVideoElement !== 'undefined' && value instanceof HTMLVideoElement;
}

function readPositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function readCurrentTime(video) {
  return readPositiveNumber(video?.currentTime);
}

function isShortMedia(video) {
  const duration = Number(video?.duration);
  return Number.isFinite(duration)
    && duration > 0
    && duration <= SHORT_MEDIA_MAX_DURATION_SEC;
}

function readVisibleRatio(video) {
  if (!video || typeof video.getBoundingClientRect !== 'function') return 0;
  const rect = video.getBoundingClientRect();
  const width = Math.max(0, Number(rect?.width) || 0);
  const height = Math.max(0, Number(rect?.height) || 0);
  const area = width * height;
  if (area <= 0) return 0;

  const viewport = typeof window !== 'undefined' ? window : null;
  const doc = typeof document !== 'undefined' ? document : null;
  const viewportWidth = Math.max(
    0,
    Number(viewport?.innerWidth) || Number(doc?.documentElement?.clientWidth) || 0,
  );
  const viewportHeight = Math.max(
    0,
    Number(viewport?.innerHeight) || Number(doc?.documentElement?.clientHeight) || 0,
  );
  if (viewportWidth <= 0 || viewportHeight <= 0) return 0;

  const left = Number.isFinite(Number(rect?.left)) ? Number(rect.left) : 0;
  const top = Number.isFinite(Number(rect?.top)) ? Number(rect.top) : 0;
  const right = Number.isFinite(Number(rect?.right)) ? Number(rect.right) : left + width;
  const bottom = Number.isFinite(Number(rect?.bottom)) ? Number(rect.bottom) : top + height;
  const visibleWidth = Math.max(0, Math.min(right, viewportWidth) - Math.max(left, 0));
  const visibleHeight = Math.max(0, Math.min(bottom, viewportHeight) - Math.max(top, 0));
  return Math.max(0, Math.min(1, (visibleWidth * visibleHeight) / area));
}

function buildHandlers(probe, video) {
  return {
    onPlay: () => probe._resetSampleAnchor(video),
    onPause: () => probe._resetSampleAnchor(video),
    onSeeking: () => probe._resetSampleAnchor(video),
    onEnded: () => probe._resetSampleAnchor(video),
    onDurationChange: () => probe._resetSampleAnchor(video),
    onTimeUpdate: () => probe._handleTimeUpdate(video),
  };
}

export class ShortMediaAttentionProbe {
  constructor({ emitEvent, now = () => Date.now() } = {}) {
    if (typeof emitEvent !== 'function') {
      throw new Error('SHORT_MEDIA_ATTENTION_EMIT_REQUIRED');
    }
    this._emitEvent = emitEvent;
    this._now = now;
    this._enabled = false;
    this._states = new Map();
    this._visibilityListenerInstalled = false;
    this._boundOnVisibilityChange = () => this._resetAllSampleAnchors();
  }

  setEnabled(enabled) {
    const nextEnabled = enabled === true;
    if (this._enabled === nextEnabled) return;
    this._enabled = nextEnabled;
    if (!this._enabled) this.destroy();
  }

  observeVideo(video) {
    if (!this._enabled) return;
    if (!isVideoElement(video)) return;
    if (this._states.has(video)) return;

    const handlers = buildHandlers(this, video);
    this._states.set(video, {
      handlers,
      lastMediaTime: null,
      lastSampleAt: null,
      pendingWatchMs: 0,
      totalWatchMs: 0,
      reportedInitial: false,
    });

    video.addEventListener('play', handlers.onPlay, true);
    video.addEventListener('pause', handlers.onPause, true);
    video.addEventListener('seeking', handlers.onSeeking, true);
    video.addEventListener('ended', handlers.onEnded, true);
    video.addEventListener('durationchange', handlers.onDurationChange, true);
    video.addEventListener('timeupdate', handlers.onTimeUpdate, true);
    this._ensureVisibilityListener();
  }

  detachVideo(video) {
    const state = this._states.get(video);
    if (!state) return;
    const { handlers } = state;
    video.removeEventListener('play', handlers.onPlay, true);
    video.removeEventListener('pause', handlers.onPause, true);
    video.removeEventListener('seeking', handlers.onSeeking, true);
    video.removeEventListener('ended', handlers.onEnded, true);
    video.removeEventListener('durationchange', handlers.onDurationChange, true);
    video.removeEventListener('timeupdate', handlers.onTimeUpdate, true);
    this._states.delete(video);
    this._teardownVisibilityListenerIfIdle();
  }

  _ensureVisibilityListener() {
    if (this._visibilityListenerInstalled) return;
    if (typeof document !== 'undefined') {
      document.addEventListener?.('visibilitychange', this._boundOnVisibilityChange, true);
      this._visibilityListenerInstalled = true;
    }
  }

  _teardownVisibilityListenerIfIdle() {
    if (!this._visibilityListenerInstalled) return;
    if (this._states.size > 0) return;
    if (typeof document !== 'undefined') {
      document.removeEventListener?.('visibilitychange', this._boundOnVisibilityChange, true);
    }
    this._visibilityListenerInstalled = false;
  }

  destroy() {
    Array.from(this._states.keys()).forEach((video) => this.detachVideo(video));
  }

  _resetSampleAnchor(video) {
    const state = this._states.get(video);
    if (!state) return;
    state.lastMediaTime = readCurrentTime(video);
    state.lastSampleAt = this._now();
  }

  _resetAllSampleAnchors() {
    this._states.forEach((_state, video) => this._resetSampleAnchor(video));
  }

  _canSample(video) {
    if (!this._enabled) return false;
    if (!isShortMedia(video)) return false;
    if (video.paused || video.ended || video.seeking) return false;
    const doc = typeof document !== 'undefined' ? document : null;
    if (doc?.visibilityState === 'hidden') return false;
    return readVisibleRatio(video) >= MIN_VISIBLE_RATIO;
  }

  _handleTimeUpdate(video) {
    const state = this._states.get(video);
    if (!state) return;

    const mediaTime = readCurrentTime(video);
    const sampleAt = this._now();
    if (state.lastMediaTime === null || state.lastSampleAt === null) {
      state.lastMediaTime = mediaTime;
      state.lastSampleAt = sampleAt;
      return;
    }

    const mediaDeltaSec = mediaTime - state.lastMediaTime;
    const wallDeltaMs = sampleAt - state.lastSampleAt;
    state.lastMediaTime = mediaTime;
    state.lastSampleAt = sampleAt;

    if (!this._canSample(video)) return;
    if (!(mediaDeltaSec > 0) || mediaDeltaSec > MAX_MEDIA_DELTA_SEC) return;
    if (!(wallDeltaMs > 0)) return;

    const watchedMs = Math.min(wallDeltaMs, MAX_WALL_DELTA_MS);
    state.pendingWatchMs += watchedMs;
    state.totalWatchMs += watchedMs;
    this._reportReadyChunks(state);
  }

  _reportReadyChunks(state) {
    if (!state.reportedInitial && state.totalWatchMs >= MIN_INITIAL_REPORT_MS) {
      const watchMs = Math.round(state.pendingWatchMs);
      state.pendingWatchMs = 0;
      state.reportedInitial = true;
      this._emitShortMediaAttention(watchMs);
      return;
    }

    while (state.reportedInitial && state.pendingWatchMs >= REPORT_CHUNK_MS) {
      state.pendingWatchMs -= REPORT_CHUNK_MS;
      this._emitShortMediaAttention(REPORT_CHUNK_MS);
    }
  }

  _emitShortMediaAttention(watchMs) {
    if (!(watchMs > 0)) return;
    this._emitEvent({
      watchMs,
      attentionKind: 'short_media',
    });
  }
}

export default ShortMediaAttentionProbe;
