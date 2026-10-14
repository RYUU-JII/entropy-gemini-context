import { runtimeSendMessage } from '../../platform/chrome/ChromeService.js';
import {
  MEDIA_FRAME_VIDEO_OBSERVATION_MODES,
  MESSAGE_TYPES,
} from '../../platform/messaging/messageTypes.js';
import { videoElementObserver } from '../../domains/nudge/video/VideoElementObserver.js';
import { getMediaShadowRootAccessCapabilities } from '../../domains/nudge/media/mediaShadowRootAccess.js';

function readString(value) {
  return typeof value === 'string' ? value : '';
}

function createLifecycleError(message, errors) {
  const normalizedErrors = errors.filter(Boolean);
  if (typeof AggregateError === 'function') {
    return new AggregateError(normalizedErrors, message);
  }
  const error = new Error(message);
  error.errors = normalizedErrors;
  return error;
}

export class TopFrameMediaDiagnosticsReporter {
  constructor({
    observer = videoElementObserver,
    sendMessage = runtimeSendMessage,
    documentTarget = globalThis.document,
    windowTarget = globalThis.window,
    now = () => Date.now(),
  } = {}) {
    this._observer = observer;
    this._sendMessage = sendMessage;
    this._document = documentTarget;
    this._window = windowTarget;
    this._now = now;
    this._unsubscribe = null;
    this._videos = new Set();
    this._startedAt = null;
    this._lastSignature = '';
    this._starting = false;
    this._observationStatus = 'inactive';
    this._observationError = null;
    this._observe = false;
    this._onReadyStateChange = () => {
      if (this._unsubscribe) this.publish('ready_state_change');
    };
    this._onVisibilityChange = () => {
      if (this._unsubscribe) this.publish('visibility_change');
    };
    this._onPageShow = () => {
      if (this._unsubscribe) this.publish('page_show');
    };
    this._listenerBindings = [
      {
        target: this._document,
        eventName: 'readystatechange',
        listener: this._onReadyStateChange,
        attached: false,
      },
      {
        target: this._document,
        eventName: 'visibilitychange',
        listener: this._onVisibilityChange,
        attached: false,
      },
      {
        target: this._window,
        eventName: 'pageshow',
        listener: this._onPageShow,
        attached: false,
      },
    ];
  }

  start({ observe = false } = {}) {
    if (this._window?.top && this._window.top !== this._window) return null;
    if (this._unsubscribe && observe !== this._observe) this.stop();
    if (this._unsubscribe) {
      this._installDocumentListeners();
      return this.publish('top_frame_reporter_reused', { force: true });
    }
    if (!this._observer || typeof this._observer.subscribe !== 'function') {
      throw new Error('TOP_FRAME_MEDIA_VIDEO_OBSERVER_REQUIRED');
    }

    this._videos.clear();
    this._observe = observe;
    this._startedAt = this._now();
    this._lastSignature = '';
    this._starting = true;
    let unsubscribe = null;
    try {
      unsubscribe = this._observer.subscribe({
        onVideo: (video) => this._handleVideoAdded(video),
        onVideoRemoved: (video) => this._handleVideoRemoved(video),
        includeExisting: true,
        observe,
        onObservationState: (status, diagnostics = {}) => {
          const error = typeof diagnostics.observationError === 'string' ? diagnostics.observationError : null;
          if (status === this._observationStatus && error === this._observationError) return;
          this._observationStatus = status;
          this._observationError = error;
          if (status === 'inactive') this._videos.clear();
          if (!this._starting) this.publish('observation_state_change');
        },
        debugLabel: 'TopFrameMediaDiagnosticsReporter.videoObserver',
      });
      if (typeof unsubscribe !== 'function') {
        throw new Error('TOP_FRAME_MEDIA_VIDEO_OBSERVER_UNSUBSCRIBE_REQUIRED');
      }
      this._unsubscribe = unsubscribe;
      this._installDocumentListeners();
      this._starting = false;
      return this.publish('top_frame_observer_started', { force: true });
    } catch (error) {
      this._starting = false;
      const cleanupErrors = [];
      if (unsubscribe && this._unsubscribe === unsubscribe) {
        try {
          unsubscribe();
          this._unsubscribe = null;
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      try {
        this._removeDocumentListeners();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      if (!this._unsubscribe) {
        this._videos.clear();
        this._startedAt = null;
        this._lastSignature = '';
      }
      if (cleanupErrors.length > 0 && error && typeof error === 'object') {
        error.cleanupError = createLifecycleError(
          'TOP_FRAME_MEDIA_DIAGNOSTICS_START_ROLLBACK_FAILED',
          cleanupErrors,
        );
      }
      throw error;
    }
  }

  stop() {
    const errors = [];
    try {
      this._removeDocumentListeners();
    } catch (error) {
      errors.push(error);
    }
    if (this._unsubscribe) {
      const unsubscribe = this._unsubscribe;
      try {
        unsubscribe();
        this._unsubscribe = null;
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw createLifecycleError('TOP_FRAME_MEDIA_DIAGNOSTICS_STOP_FAILED', errors);
    }
    this._videos.clear();
    this._observationStatus = 'inactive';
    this._observationError = null;
    this._startedAt = null;
    this._lastSignature = '';
  }

  publish(reason = 'top_frame_report', { force = false } = {}) {
    const payload = this._buildPayload(reason);
    const signature = JSON.stringify({
      url: payload.url,
      readyState: payload.readyState,
      visibilityState: payload.visibilityState,
      videoCount: payload.videoCount,
      hasVideo: payload.hasVideo,
      videoObservationMode: payload.videoObservationMode,
      status: payload.status,
      observationError: payload.observationError,
      shadowRootAccess: payload.shadowRootAccess,
    });
    if (!force && signature === this._lastSignature) return payload;
    this._lastSignature = signature;

    try {
      Promise.resolve(this._sendMessage({
        type: MESSAGE_TYPES.CONTENT_MEDIA_FRAME_STATE,
        payload,
      })).catch((error) => {
        this._lastSignature = '';
        console.warn('[TopFrameMediaDiagnosticsReporter] report failed.', error);
      });
    } catch (error) {
      this._lastSignature = '';
      console.warn('[TopFrameMediaDiagnosticsReporter] report failed.', error);
    }
    return payload;
  }

  _buildPayload(reason) {
    const observed = this._observationStatus === 'observed';
    const videoCount = observed ? this._videos.size : null;
    return {
      status: this._observationStatus,
      observationError: this._observationError,
      shadowRootAccess: getMediaShadowRootAccessCapabilities().mode,
      lateShadowDiscovery: 'explicit_registration_or_document_event',
      reason,
      url: readString(this._window?.location?.href),
      startedAt: this._startedAt || this._now(),
      reportedAt: this._now(),
      frameKind: 'top',
      topFrame: true,
      videoObservationMode: MEDIA_FRAME_VIDEO_OBSERVATION_MODES.TOP_FRAME_CANONICAL,
      readyState: readString(this._document?.readyState),
      visibilityState: readString(this._document?.visibilityState),
      htmlVideoElementAvailable: typeof this._window?.HTMLVideoElement === 'function',
      videoCount,
      hasVideo: observed ? videoCount > 0 : null,
    };
  }

  _handleVideoAdded(video) {
    const sizeBefore = this._videos.size;
    this._videos.add(video);
    if (!this._starting && this._videos.size !== sizeBefore) {
      this.publish('video_added');
    }
  }

  _handleVideoRemoved(video) {
    if (!this._videos.delete(video) || this._starting) return;
    this.publish('video_removed');
  }

  _installDocumentListeners() {
    this._listenerBindings.forEach((binding) => {
      if (binding.attached || typeof binding.target?.addEventListener !== 'function') return;
      binding.target.addEventListener(binding.eventName, binding.listener, true);
      binding.attached = true;
    });
  }

  _removeDocumentListeners() {
    const errors = [];
    this._listenerBindings.forEach((binding) => {
      if (!binding.attached) return;
      try {
        binding.target.removeEventListener(binding.eventName, binding.listener, true);
        binding.attached = false;
      } catch (error) {
        errors.push(error);
      }
    });
    if (errors.length > 0) {
      throw createLifecycleError('TOP_FRAME_MEDIA_DIAGNOSTICS_LISTENER_REMOVE_FAILED', errors);
    }
  }
}

const topFrameMediaDiagnosticsReporter = new TopFrameMediaDiagnosticsReporter();

export function startTopFrameMediaDiagnostics(options) {
  try {
    return topFrameMediaDiagnosticsReporter.start(options);
  } catch (error) {
    console.warn('[TopFrameMediaDiagnosticsReporter] start failed.', error);
    return null;
  }
}

export function teardownTopFrameMediaDiagnostics() {
  try {
    topFrameMediaDiagnosticsReporter.stop();
    return true;
  } catch (error) {
    console.warn('[TopFrameMediaDiagnosticsReporter] stop failed.', error);
    return false;
  }
}

export default topFrameMediaDiagnosticsReporter;
