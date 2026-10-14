import { normalizeVideoMutationRoots } from '../video/VideoElementObserver.js';
import { VIDEO_SKIP_NATIVE_CONTROL_FAMILIES } from './videoSkipControlSurfaceCatalog.js';
import { readMediaShadowRoot } from '../media/mediaShadowRootAccess.js';

const TIMELINE_POINTER_EVENT_NAMES = Object.freeze([
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'mousedown',
  'mousemove',
  'mouseup',
  'click',
  'dblclick',
  'auxclick',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
]);

export const VIDEO_SKIP_TIMELINE_LOCK_ATTRIBUTE = 'data-friction-video-skip-timeline-lock';
export const VIDEO_SKIP_TIMELINE_TARGET_ATTRIBUTE = 'data-friction-video-skip-timeline-target';
export const VIDEO_SKIP_NATIVE_VIDEO_ATTRIBUTE = 'data-friction-video-skip-native-owner';
export const VIDEO_SKIP_CONTROL_SURFACE_STYLE_ID = 'friction-video-skip-control-surface-lock';
const STYLE_OWNER = 'video-skip-control-surface-runtime';
const INSTAGRAM_TIMELINE_MIN_WIDTH_PX = 48;
const INSTAGRAM_TIMELINE_MIN_ASPECT_RATIO = 2.5;
const INSTAGRAM_TIMELINE_MIN_PLAYER_WIDTH_RATIO = 0.15;
const INSTAGRAM_PLAYER_MAX_ANCESTOR_DEPTH = 12;
const INSTAGRAM_PLAYER_MAX_SIZE_RATIO = 1.35;
const INSTAGRAM_PLAYER_MIN_SIZE_RATIO = 0.85;

function isElement(value) {
  return value?.nodeType === 1 && typeof value.matches === 'function' && typeof value.contains === 'function';
}

function isDocumentRoot(value) {
  return value?.nodeType === 9;
}

function isMediaShadowRoot(value) {
  return value?.nodeType === 11 && isElement(value.host) && readMediaShadowRoot(value.host) === value;
}

function getEventPathElements(event) {
  const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
  const elements = path.filter(isElement);
  if (isElement(event?.target) && !elements.includes(event.target)) elements.unshift(event.target);
  return elements;
}

function matchesSelector(element, selector) {
  return isElement(element) && element.matches(selector);
}

function composedContains(root, node) {
  let candidate = node;
  while (candidate) {
    if (candidate === root || root?.contains?.(candidate)) return true;
    const candidateRoot = candidate.getRootNode?.();
    candidate = isMediaShadowRoot(candidateRoot) ? candidateRoot.host : null;
  }
  return false;
}

function hasExplicitVideoLink(target, video) {
  if (!video?.id) return false;
  const ids = (target.getAttribute('aria-controls') || '').trim().split(/\s+/);
  return ids.length === 1 && ids[0] === video.id;
}

function sharesBoundedPlayerAncestor(node, video, documentRef) {
  let ancestor = video.parentElement;
  for (let depth = 0; ancestor && depth < 5; depth += 1, ancestor = ancestor.parentElement) {
    if (ancestor === documentRef.body || ancestor === documentRef.documentElement) break;
    if (ancestor.contains(node)) return true;
  }
  return false;
}

function isDeclaredNativeTimeline(target, playerRoot, video) {
  const videos = Array.from(playerRoot.querySelectorAll('video'));
  if (videos.length !== 1 || videos[0] !== video) return false;
  const controls = target.getAttribute('aria-controls');
  if (controls && !hasExplicitVideoLink(target, video)) return false;
  const family = VIDEO_SKIP_NATIVE_CONTROL_FAMILIES.find((entry) => target.matches(entry.timeline));
  if (family) return playerRoot.matches(family.player);
  if (target.getAttribute('data-media-control') === 'seek') return true;
  return hasExplicitVideoLink(target, video)
    && /seek|progress|timeline|scrub|탐색|진행/i.test(target.getAttribute('aria-label') || '')
    && hasNumericRangeSemantics(target);
}

function findDeclaredPlayerRoot(video, selector) {
  let candidate = video;
  while (isElement(candidate)) {
    if (matchesSelector(candidate, selector)) return candidate;
    if (candidate.parentElement) {
      candidate = candidate.parentElement;
      continue;
    }
    const root = candidate.getRootNode?.() || null;
    candidate = isMediaShadowRoot(root) ? root.host : null;
  }
  return null;
}

function hasExplicitTimelineSemantics(element) {
  return ['data-testid', 'data-e2e', 'part']
    .some((name) => /progress|seek|scrub/i.test(element.getAttribute?.(name) || ''));
}

function hasNumericRangeSemantics(element) {
  const role = element.getAttribute?.('role') || '';
  const tagName = String(element.tagName || '').toUpperCase();
  const type = String(element.getAttribute?.('type') || '').toLowerCase();
  if (role !== 'slider' && !(tagName === 'INPUT' && type === 'range')) return false;
  const min = Number(element.getAttribute?.('aria-valuemin') ?? element.getAttribute?.('min') ?? 0);
  const max = Number(element.getAttribute?.('aria-valuemax') ?? element.getAttribute?.('max'));
  return Number.isFinite(min) && Number.isFinite(max) && max > min;
}

function isInstagramStructuralTimeline(element, playerRoot) {
  if (hasExplicitTimelineSemantics(element)) return true;
  if (!hasNumericRangeSemantics(element)) return false;
  const rect = element.getBoundingClientRect?.();
  const playerRect = playerRoot.getBoundingClientRect?.();
  const width = Number(rect?.width) || 0;
  const height = Number(rect?.height) || 0;
  const playerWidth = Number(playerRect?.width) || 0;
  const minimumWidth = Math.max(
    INSTAGRAM_TIMELINE_MIN_WIDTH_PX,
    playerWidth * INSTAGRAM_TIMELINE_MIN_PLAYER_WIDTH_RATIO,
  );
  return width >= minimumWidth
    && height > 0
    && width / height >= INSTAGRAM_TIMELINE_MIN_ASPECT_RATIO;
}

function normalizeLockState(rawState, _now = Date.now()) {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_LOCK_STATE_REQUIRED');
  }
  if (typeof rawState.locked !== 'boolean') {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_LOCK_STATE_INVALID');
  }
  if (!rawState.locked) {
    return Object.freeze({ locked: false, reason: null, unlockAt: null });
  }
  if (rawState.reason !== 'hard_block') {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_LOCK_REASON_INVALID');
  }
  return Object.freeze({ locked: true, reason: 'hard_block', unlockAt: null });
}

function buildListenerBindings(listener) {
  return Object.freeze([
    ...TIMELINE_POINTER_EVENT_NAMES.map((eventName) => Object.freeze({
      eventName,
      listener,
      options: Object.freeze({ capture: true, passive: false }),
    })),
    Object.freeze({
      eventName: 'keydown',
      listener,
      options: Object.freeze({ capture: true, passive: false }),
    }),
  ]);
}

const RESTRAINED_SEEK_CURSOR_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'><g filter='url(%23s)'><rect x='4.5' y='3.5' width='2.5' height='17' rx='1.25' fill='%23FFFFFF' stroke='%230F1214' stroke-width='1.2'/><rect x='17' y='3.5' width='2.5' height='17' rx='1.25' fill='%23FFFFFF' stroke='%230F1214' stroke-width='1.2'/><circle cx='12' cy='12' r='2.75' fill='%23FFFFFF' stroke='%230F1214' stroke-width='1.2'/></g><defs><filter id='s' x='0' y='0' width='24' height='24' filterUnits='userSpaceOnUse'><feDropShadow dx='0' dy='1' stdDeviation='1.2' flood-color='%23000000' flood-opacity='0.75'/></filter></defs></svg>";
const RESTRAINED_SEEK_CURSOR = `url("data:image/svg+xml,${RESTRAINED_SEEK_CURSOR_SVG}") 12 12, not-allowed`;

function createLifecycleError(message, errors) {
  const failures = Array.isArray(errors) ? errors.filter(Boolean) : [];
  if (typeof AggregateError === 'function') return new AggregateError(failures, message);
  const error = new Error(message);
  error.errors = failures;
  if (failures[0]) error.cause = failures[0];
  return error;
}

function buildDocumentStyle(profile) {
  const lockScope = `html[${VIDEO_SKIP_TIMELINE_LOCK_ATTRIBUTE}]`;
  const declaredPlayerScope = `${lockScope} ${profile.playerRootSelector}:has(video)`;
  return `
${buildNativeTimelineStyle(lockScope)}
${lockScope} [${VIDEO_SKIP_TIMELINE_TARGET_ATTRIBUTE}="1"] {
  cursor: ${RESTRAINED_SEEK_CURSOR} !important;
  /* Keep hover and blocked-input feedback reachable; capture listeners stop native seeking. */
  pointer-events: auto !important;
  touch-action: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}

${declaredPlayerScope} ${profile.scrubberSelector},
${declaredPlayerScope} ${profile.previewSelector} {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
`;
}

function buildShadowStyle(profile) {
  const scope = `:host-context(html[${VIDEO_SKIP_TIMELINE_LOCK_ATTRIBUTE}])`;
  return `
${buildNativeTimelineStyle(scope)}
${scope} [${VIDEO_SKIP_TIMELINE_TARGET_ATTRIBUTE}="1"] {
  cursor: ${RESTRAINED_SEEK_CURSOR} !important;
  /* Keep hover and blocked-input feedback reachable; capture listeners stop native seeking. */
  pointer-events: auto !important;
  touch-action: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}

${scope} ${profile.scrubberSelector},
${scope} ${profile.previewSelector} {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
`;
}

function buildNativeTimelineStyle(scope) {
  // Chromium keeps native slider input inside its UA shadow tree. Window/root
  // capture cannot veto it. Scope the platform pseudo-element to owned videos;
  // never disable the entire native panel or mutate browser-internal DOM.
  // An inert visible slider passes clicks to the video, whose native handler
  // can pause or enter fullscreen. Remove that unavailable affordance instead.
  // Native time labels and the remaining controls retain their own behavior.
  return `${scope} video[controls][${VIDEO_SKIP_NATIVE_VIDEO_ATTRIBUTE}="1"]::-webkit-media-controls-timeline {
  display: none !important;
}`;
}

function getVideoRoot(video) {
  if (!video || String(video.nodeName || '').toUpperCase() !== 'VIDEO') {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_VIDEO_REQUIRED');
  }
  if (typeof video.getRootNode !== 'function') {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_VIDEO_ROOT_REQUIRED');
  }
  const root = video.getRootNode();
  if (!isDocumentRoot(root) && !isMediaShadowRoot(root)) {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_REACHABLE_ROOT_REQUIRED');
  }
  return root;
}

export class VideoSkipControlSurfaceRuntime {
  constructor({
    profile,
    resolveLockState,
    isKeyboardSeekInput,
    onBlockedInput,
    onFailure,
    onObservedGesture = null,
    subscribeMediaMutations,
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
  } = {}) {
    if (!profile || typeof profile !== 'object') {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_PROFILE_REQUIRED');
    }
    if (typeof resolveLockState !== 'function') {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_LOCK_STATE_RESOLVER_REQUIRED');
    }
    if (typeof isKeyboardSeekInput !== 'function') {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_KEYBOARD_CLASSIFIER_REQUIRED');
    }
    if (typeof onBlockedInput !== 'function') {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_BLOCKED_INPUT_HANDLER_REQUIRED');
    }
    if (typeof onFailure !== 'function') {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_FAILURE_HANDLER_REQUIRED');
    }
    if (typeof subscribeMediaMutations !== 'function') {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_MEDIA_MUTATION_SUBSCRIBER_REQUIRED');
    }
    this._subscribeMediaMutations = subscribeMediaMutations;
    this._mediaMutationUnsub = null;
    this.profile = profile;
    this._resolveLockState = resolveLockState;
    this._isKeyboardSeekInput = isKeyboardSeekInput;
    this._onBlockedInput = onBlockedInput;
    this._onFailure = onFailure;
    this._onObservedGesture = onObservedGesture;
    this._window = windowRef;
    this._document = documentRef;
    this._bindings = [];
    this._rootStyles = new Map();
    this._trackedVideos = new Set();
    this._videoRoots = new WeakMap();
    this._videoPlayerOwnership = new WeakMap();
    this._timelineScopes = new Map();
    this._timelineTargets = new Map();
    this._appliedLockKey = null;
    this._boundOnInput = this._onInput.bind(this);
    this._handledInputEvents = new WeakSet();
  }

  install() {
    if (this._bindings.length > 0) {
      this.sync();
      return;
    }
    if (this._mediaMutationUnsub) {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_REMOVE_PENDING');
    }
    if (!this._window || !this._document?.documentElement) {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_DOCUMENT_REQUIRED');
    }
    this._assertSelectorSyntax();

    const installedBindings = [];
    try {
      this._ensureRootStyle(this._document);
      const bindings = buildListenerBindings(this._boundOnInput);
      bindings.forEach((binding) => {
        this._window.addEventListener(binding.eventName, binding.listener, binding.options);
        installedBindings.push(binding);
      });
      this._bindings = installedBindings;
      this.sync();
      this._mediaMutationUnsub = this._subscribeMediaMutations({
        onMutation: (payload) => this._handleMediaMutations(payload),
        debugLabel: 'VideoSkipControlSurfaceRuntime.timeline',
      });
    } catch (error) {
      [...installedBindings].reverse().forEach((binding) => {
        try {
          this._window.removeEventListener(binding.eventName, binding.listener, binding.options);
        } catch (cleanupError) {
          this._onFailure(cleanupError, {
            phase: 'install_rollback_listener',
            eventName: binding.eventName,
            profileId: this.profile.id,
          });
        }
      });
      this._bindings = [];
      this._clearLockProjection();
      this._removeAllRootStyles();
      throw error;
    }
  }

  trackVideo(video) {
    const root = getVideoRoot(video);
    if (video.ownerDocument !== this._document) {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_VIDEO_DOCUMENT_MISMATCH');
    }
    const previousRoot = this._videoRoots.get(video) || null;
    if (previousRoot === root && this._trackedVideos.has(video)) {
      video.setAttribute(VIDEO_SKIP_NATIVE_VIDEO_ATTRIBUTE, '1');
      this._reconcileVideoPlayer(video, { rescan: true });
      return this._buildTrackReceipt(video, root);
    }
    if (previousRoot) this._releaseVideoRoot(video, previousRoot);
    this._ensureRootStyle(root);
    const entry = this._rootStyles.get(root);
    entry.videos.add(video);
    this._trackedVideos.add(video);
    this._videoRoots.set(video, root);
    video.setAttribute(VIDEO_SKIP_NATIVE_VIDEO_ATTRIBUTE, '1');
    this._reconcileVideoPlayer(video, { rescan: true });
    return this._buildTrackReceipt(video, root);
  }

  untrackVideo(video) {
    video.removeAttribute(VIDEO_SKIP_NATIVE_VIDEO_ATTRIBUTE);
    this._releaseTimelineTargetsForVideo(video);
    this._releaseVideoPlayer(video);
    const root = this._videoRoots.get(video) || null;
    if (root) this._releaseVideoRoot(video, root);
    this._trackedVideos.delete(video);
    this._videoRoots.delete(video);
  }

  sync() {
    this._reconcileVideoRoots();
    this._pruneTimelineTargets();
    const state = normalizeLockState(this._resolveLockState(), Date.now());
    const lockKey = state.locked ? 'hard_block' : 'unlocked';
    if (this._appliedLockKey === lockKey) return state;

    if (state.locked) {
      this._document.documentElement.setAttribute(
        VIDEO_SKIP_TIMELINE_LOCK_ATTRIBUTE,
        state.reason,
      );
    } else {
      this._document.documentElement.removeAttribute(VIDEO_SKIP_TIMELINE_LOCK_ATTRIBUTE);
    }
    this._appliedLockKey = lockKey;
    return state;
  }

  getRuntimeSnapshot() {
    const lockState = normalizeLockState(this._resolveLockState(), Date.now());
    const rootKinds = [];
    for (const root of this._rootStyles.keys()) {
      rootKinds.push(isDocumentRoot(root) ? 'document' : `${root.mode}_shadow`);
    }
    return Object.freeze({
      profileId: this.profile.id,
      siteId: this.profile.siteId,
      installed: this._bindings.length > 0,
      bindingCount: this._bindings.length,
      trackedVideoCount: this._trackedVideos.size,
      nativeControlVideoCount: Array.from(this._trackedVideos).filter((video) => video.controls === true).length,
      nativeTimelineProjection: 'chromium_hidden_timeline',
      admittedTimelineTargetCount: this._timelineTargets.size,
      styledRootCount: this._rootStyles.size,
      styledRootKinds: Object.freeze(rootKinds.sort()),
      lockState,
      documentLockAttribute: this._document?.documentElement?.getAttribute?.(
        VIDEO_SKIP_TIMELINE_LOCK_ATTRIBUTE,
      ) || null,
    });
  }

  ownsVideoControls(video) {
    return this._videoPlayerOwnership.has(video)
      || (this._trackedVideos.has(video) && video.controls === true);
  }

  getVideoControlCapability(video) {
    const tracked = this._trackedVideos.has(video);
    return Object.freeze({
      kind: tracked && video.controls === true ? 'browser_native'
        : this._videoPlayerOwnership.has(video) ? 'author_declared' : 'unresolved',
      nativeTimelineLockProjected: tracked && video.controls === true
        && this._appliedLockKey === 'hard_block'
        && video.getAttribute(VIDEO_SKIP_NATIVE_VIDEO_ATTRIBUTE) === '1',
      nativeInputObservable: false,
    });
  }

  shouldDeferGestureToRoot(event) {
    // WindowProxy identity can differ from the realm's window reference.
    if (event?.currentTarget !== this._window && event?.currentTarget?.document !== this._document) return false;
    const path = getEventPathElements(event);
    for (const trackedRoot of this._rootStyles.keys()) {
      let root = trackedRoot;
      while (isMediaShadowRoot(root)) {
        if (root.mode === 'closed' && path.includes(root.host)) return true;
        root = root.host.getRootNode();
      }
    }
    return false;
  }

  teardown() {
    const failures = [];
    this._clearLockProjection();
    this._bindings.forEach((binding) => {
      try {
        this._window.removeEventListener(binding.eventName, binding.listener, binding.options);
      } catch (error) {
        failures.push(error);
        this._onFailure(error, {
          phase: 'listener_remove',
          eventName: binding.eventName,
          profileId: this.profile.id,
        });
      }
    });
    if (failures.length === 0) this._bindings = [];
    if (this._mediaMutationUnsub) {
      try {
        this._mediaMutationUnsub();
        this._mediaMutationUnsub = null;
      } catch (error) {
        failures.push(error);
        this._onFailure(error, { phase: 'media_mutation_unsubscribe', profileId: this.profile.id });
      }
    }
    try {
      this._disconnectAllTimelineScopes();
    } catch (error) {
      failures.push(error);
      this._onFailure(error, { phase: 'timeline_scope_remove', profileId: this.profile.id });
    }
    try {
      this._removeAllRootStyles();
    } catch (error) {
      failures.push(error);
      this._onFailure(error, { phase: 'style_remove', profileId: this.profile.id });
    }
    try {
      this._removeAllTimelineTargets();
    } catch (error) {
      failures.push(error);
      this._onFailure(error, { phase: 'timeline_target_remove', profileId: this.profile.id });
    }
    if (failures.length > 0) {
      throw createLifecycleError('VIDEO_SKIP_CONTROL_SURFACE_REMOVE_FAILED', failures);
    }
    this._trackedVideos.clear();
    this._videoRoots = new WeakMap();
    this._videoPlayerOwnership = new WeakMap();
  }

  _assertSelectorSyntax() {
    const probe = this._document.createElement('div');
    [
      'playerRootSelector',
      'timelineTargetSelector',
      'excludedTargetSelector',
      'scrubberSelector',
      'previewSelector',
    ]
      .forEach((key) => probe.matches(this.profile[key]));
    probe.matches(`${this.profile.playerRootSelector}:has(video)`);
  }

  _buildTrackReceipt(video, root) {
    return Object.freeze({
      profileId: this.profile.id,
      siteId: this.profile.siteId,
      rootKind: isDocumentRoot(root) ? 'document' : `${root.mode}_shadow`,
      playerRootMatched: !!this._videoPlayerOwnership.get(video)?.playerRoot,
      controlCapability: this.getVideoControlCapability(video),
    });
  }

  _ensureRootStyle(root) {
    const existingEntry = this._rootStyles.get(root);
    if (existingEntry) {
      this._installRootInputs(root, existingEntry);
      return existingEntry.style;
    }
    const existingStyle = root.querySelector?.(`#${VIDEO_SKIP_CONTROL_SURFACE_STYLE_ID}`) || null;
    if (existingStyle && existingStyle.tagName !== 'STYLE') {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_STYLE_CONFLICT');
    }
    if (existingStyle && existingStyle.getAttribute('data-friction-owner') !== STYLE_OWNER) {
      throw new Error('VIDEO_SKIP_CONTROL_SURFACE_STYLE_CONFLICT');
    }
    const style = existingStyle || this._document.createElement('style');
    style.id = VIDEO_SKIP_CONTROL_SURFACE_STYLE_ID;
    style.setAttribute('data-friction-owner', STYLE_OWNER);
    style.setAttribute('data-friction-profile', this.profile.id);
    style.textContent = isDocumentRoot(root)
      ? buildDocumentStyle(this.profile)
      : buildShadowStyle(this.profile);
    if (!style.parentNode) {
      const host = isDocumentRoot(root)
        ? (this._document.head || this._document.documentElement)
        : root;
      if (!host) throw new Error('VIDEO_SKIP_CONTROL_SURFACE_STYLE_HOST_REQUIRED');
      host.appendChild(style);
    }
    const entry = { style, videos: new Set(), bindings: [] };
    this._rootStyles.set(root, entry);
    this._installRootInputs(root, entry);
    return style;
  }

  _installRootInputs(root, entry) {
    if (isDocumentRoot(root)) return;
    for (const binding of buildListenerBindings(this._boundOnInput)) {
      if (entry.bindings.some((owned) => owned.eventName === binding.eventName)) continue;
      root.addEventListener(binding.eventName, binding.listener, binding.options);
      entry.bindings.push(binding);
    }
  }

  _removeRootInputs(root, entry) {
    const remaining = [];
    const failures = [];
    for (const binding of entry.bindings) {
      try { root.removeEventListener(binding.eventName, binding.listener, binding.options); }
      catch (error) { remaining.push(binding); failures.push(error); }
    }
    entry.bindings = remaining;
    if (failures.length) throw createLifecycleError('VIDEO_SKIP_ROOT_INPUT_CLEANUP_FAILED', failures);
  }

  _releaseVideoRoot(video, root) {
    const entry = this._rootStyles.get(root);
    if (!entry) return;
    const releasingFinalVideo = entry.videos.has(video) && entry.videos.size === 1;
    if (!isDocumentRoot(root) && releasingFinalVideo) {
      this._removeRootInputs(root, entry);
      entry.style.remove();
      this._rootStyles.delete(root);
      return;
    }
    entry.videos.delete(video);
  }

  _removeAllRootStyles() {
    const failures = [];
    for (const [root, entry] of this._rootStyles) {
      try {
        this._removeRootInputs(root, entry);
        entry.style.remove();
        this._rootStyles.delete(root);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw createLifecycleError('VIDEO_SKIP_CONTROL_SURFACE_STYLE_REMOVE_FAILED', failures);
    }
  }

  _reconcileVideoRoots() {
    for (const video of this._trackedVideos) {
      if (video.ownerDocument !== this._document) {
        this.untrackVideo(video);
        continue;
      }
      if (video.isConnected === false) continue;
      const root = getVideoRoot(video);
      const previousRoot = this._videoRoots.get(video) || null;
      if (root === previousRoot) {
        this._reconcileVideoPlayer(video);
        continue;
      }
      if (previousRoot) this._releaseVideoRoot(video, previousRoot);
      this._ensureRootStyle(root);
      this._rootStyles.get(root).videos.add(video);
      this._videoRoots.set(video, root);
      this._reconcileVideoPlayer(video, { rescan: true });
    }
  }

  _queryTimelineTargets(scope) {
    const targets = [];
    if (isElement(scope) && matchesSelector(scope, this.profile.timelineTargetSelector)) {
      targets.push(scope);
    }
    scope?.querySelectorAll?.(this.profile.timelineTargetSelector).forEach((target) => {
      targets.push(target);
    });
    return targets;
  }

  _isExcludedTimelineTarget(target, scope) {
    let candidate = target;
    while (isElement(candidate)) {
      if (matchesSelector(candidate, this.profile.excludedTargetSelector)) return true;
      if (candidate === scope) break;
      candidate = candidate.parentElement;
    }
    return false;
  }

  _findInstagramStructuralPlayerRoot(video) {
    const videoRect = video.getBoundingClientRect?.() || null;
    const videoWidth = Number(videoRect?.width) || 0;
    const videoHeight = Number(videoRect?.height) || 0;
    let ancestor = video.parentElement;
    let mediaEnvelope = ancestor;
    let depth = 0;

    while (isElement(ancestor) && depth < INSTAGRAM_PLAYER_MAX_ANCESTOR_DEPTH) {
      const hasTimeline = this._queryTimelineTargets(ancestor).some((target) => (
        !this._isExcludedTimelineTarget(target, ancestor)
        && isInstagramStructuralTimeline(target, ancestor)
      ));
      if (hasTimeline) return ancestor;

      const rect = ancestor.getBoundingClientRect?.() || null;
      const width = Number(rect?.width) || 0;
      const height = Number(rect?.height) || 0;
      const followsMediaGeometry = videoWidth > 0
        && videoHeight > 0
        && width >= videoWidth * INSTAGRAM_PLAYER_MIN_SIZE_RATIO
        && height >= videoHeight * INSTAGRAM_PLAYER_MIN_SIZE_RATIO
        && width <= videoWidth * INSTAGRAM_PLAYER_MAX_SIZE_RATIO
        && height <= videoHeight * INSTAGRAM_PLAYER_MAX_SIZE_RATIO;
      if (followsMediaGeometry) {
        mediaEnvelope = ancestor;
      } else if (mediaEnvelope && width > 0 && height > 0) {
        break;
      }

      if (!ancestor.parentElement) break;
      ancestor = ancestor.parentElement;
      depth += 1;
    }
    return mediaEnvelope || null;
  }

  _resolvePlayerRoot(video) {
    const declared = findDeclaredPlayerRoot(video, this.profile.playerRootSelector);
    if (declared) {
      if (this.profile.timelineValidation !== 'native_declared') return declared;
      const videos = Array.from(declared.querySelectorAll('video'));
      return videos.length === 1 && videos[0] === video ? declared : null;
    }
    if (this.profile.timelineValidation === 'instagram_structural') {
      return this._findInstagramStructuralPlayerRoot(video);
    }
    if (this.profile.timelineValidation === 'native_declared' && video.id) {
      let ancestor = video.parentElement;
      for (let depth = 0; ancestor && depth < 5; depth += 1, ancestor = ancestor.parentElement) {
        if (ancestor === this._document.body || ancestor === this._document.documentElement) break;
        if (this._queryTimelineTargets(ancestor).some((target) => (
          hasExplicitVideoLink(target, video)
          && !this._isExcludedTimelineTarget(target, ancestor)
          && isDeclaredNativeTimeline(target, ancestor, video)
        ))) return ancestor;
      }
    }
    return null;
  }

  _resolveTimelineScope(video, playerRoot) {
    const videoRoot = this._videoRoots.get(video) || getVideoRoot(video);
    if (!isMediaShadowRoot(videoRoot)) return playerRoot;
    if (playerRoot.getRootNode?.() === videoRoot) return playerRoot;
    return videoRoot;
  }

  _handleMediaMutations({ addedNodes = [], removedNodes = [], attributeTargets = [], observedRoots = [] }) {
    try {
      const changed = [...addedNodes, ...removedNodes, ...attributeTargets, ...observedRoots];
      for (const video of this._trackedVideos) {
        if (video.isConnected === false) continue;
        const ownership = this._videoPlayerOwnership.get(video);
        const affected = changed.some((node) => (
          composedContains(node, video)
          || (ownership && (composedContains(ownership.scope, node)
            || composedContains(node, ownership.scope)))
          || (!ownership && sharesBoundedPlayerAncestor(node, video, this._document))
        ));
        if (affected) {
          if (getVideoRoot(video) !== this._videoRoots.get(video)) this.trackVideo(video);
          else this._reconcileVideoPlayer(video, { rescan: true });
        }
      }
      const roots = normalizeVideoMutationRoots(addedNodes);
      for (const [scope, entry] of this._timelineScopes) {
        if (!scope.isConnected) continue;
        for (const node of roots) {
          if (scope === node || scope.contains(node)) {
            this._scanTimelineSubtree(entry, node);
          } else if (node.contains(scope)) {
            // A reparented player may be nested inside a shared added root.
            // Query only this tracked player's scope, never the outer subtree.
            this._scanTimelineScope(entry, scope);
          }
        }
      }
      if (removedNodes.length > 0 || attributeTargets.length > 0) this._pruneTimelineTargets();
    } catch (error) {
      this._onFailure(error, {
        phase: 'timeline_scope_mutation',
        profileId: this.profile.id,
      });
    }
  }

  _attachTimelineScope(video, playerRoot, scope) {
    let entry = this._timelineScopes.get(scope) || null;
    if (!entry) {
      entry = {
        playerRoot,
        videos: new Set(),
      };
      this._timelineScopes.set(scope, entry);
    }
    entry.videos.add(video);
    this._scanTimelineScope(entry, scope);
  }

  _releaseTimelineScope(video, scope) {
    const entry = this._timelineScopes.get(scope);
    if (!entry) return;
    entry.videos.delete(video);
    if (entry.videos.size > 0) return;
    this._timelineScopes.delete(scope);
  }

  _disconnectAllTimelineScopes() {
    this._timelineScopes.clear();
  }

  _scanTimelineSubtree(entry, subtree) {
    const video = [...entry.videos].find((candidate) => this._trackedVideos.has(candidate)) || null;
    if (!video) return;
    const targets = [];
    if (matchesSelector(subtree, this.profile.timelineTargetSelector)) targets.push(subtree);
    subtree.querySelectorAll?.(this.profile.timelineTargetSelector).forEach((target) => {
      targets.push(target);
    });
    targets.forEach((target) => {
      if (this._isExcludedTimelineTarget(target, entry.playerRoot)) return;
      this._admitTimelineTarget(target, entry.playerRoot, video);
    });
  }

  _scanTimelineScope(entry, scope) {
    const video = [...entry.videos].find((candidate) => this._trackedVideos.has(candidate)) || null;
    if (!video) return;
    this._queryTimelineTargets(scope).forEach((target) => {
      if (this._isExcludedTimelineTarget(target, entry.playerRoot)) return;
      this._admitTimelineTarget(target, entry.playerRoot, video);
    });
  }

  _releaseVideoPlayer(video) {
    const ownership = this._videoPlayerOwnership.get(video) || null;
    if (!ownership) return;
    this._releaseTimelineScope(video, ownership.scope);
    this._videoPlayerOwnership.delete(video);
  }

  _reconcileVideoPlayer(video, { rescan = false } = {}) {
    const playerRoot = this._resolvePlayerRoot(video);
    const scope = playerRoot ? this._resolveTimelineScope(video, playerRoot) : null;
    const previous = this._videoPlayerOwnership.get(video) || null;
    if (previous?.playerRoot === playerRoot && previous?.scope === scope) {
      if (rescan && scope) {
        const entry = this._timelineScopes.get(scope);
        if (entry) this._scanTimelineScope(entry, scope);
      }
      return previous;
    }

    this._releaseTimelineTargetsForVideo(video);
    if (previous) this._releaseTimelineScope(video, previous.scope);
    if (!playerRoot || !scope) {
      this._videoPlayerOwnership.delete(video);
      return null;
    }
    const ownership = Object.freeze({ playerRoot, scope });
    this._videoPlayerOwnership.set(video, ownership);
    this._attachTimelineScope(video, playerRoot, scope);
    return ownership;
  }

  _isTimelineTargetAdmitted(timelineTarget, playerRoot, video) {
    if (this.profile.timelineValidation === 'selector') return true;
    if (this.profile.timelineValidation === 'instagram_structural') {
      return isInstagramStructuralTimeline(timelineTarget, playerRoot);
    }
    if (this.profile.timelineValidation === 'native_declared') {
      return isDeclaredNativeTimeline(timelineTarget, playerRoot, video);
    }
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_TIMELINE_VALIDATION_INVALID');
  }

  _admitTimelineTarget(timelineTarget, playerRoot, video) {
    if (!this._isTimelineTargetAdmitted(timelineTarget, playerRoot, video)) return false;
    if (timelineTarget.getAttribute(VIDEO_SKIP_TIMELINE_TARGET_ATTRIBUTE) !== '1') {
      timelineTarget.setAttribute(VIDEO_SKIP_TIMELINE_TARGET_ATTRIBUTE, '1');
    }
    this._timelineTargets.set(timelineTarget, video);
    return true;
  }

  _releaseTimelineTargetsForVideo(video) {
    for (const [target, ownerVideo] of this._timelineTargets) {
      if (ownerVideo !== video) continue;
      target.removeAttribute(VIDEO_SKIP_TIMELINE_TARGET_ATTRIBUTE);
      this._timelineTargets.delete(target);
    }
  }

  _pruneTimelineTargets() {
    for (const [target, video] of this._timelineTargets) {
      const ownership = this._videoPlayerOwnership.get(video) || null;
      const stillOwned = target.isConnected !== false
        && this._trackedVideos.has(video)
        && ownership?.scope?.contains?.(target)
        && matchesSelector(target, this.profile.timelineTargetSelector)
        && !this._isExcludedTimelineTarget(target, ownership.playerRoot)
        && this._isTimelineTargetAdmitted(target, ownership.playerRoot, video);
      if (stillOwned) continue;
      target.removeAttribute(VIDEO_SKIP_TIMELINE_TARGET_ATTRIBUTE);
      this._timelineTargets.delete(target);
    }
  }

  _removeAllTimelineTargets() {
    const failures = [];
    for (const video of this._trackedVideos) {
      try { video.removeAttribute(VIDEO_SKIP_NATIVE_VIDEO_ATTRIBUTE); }
      catch (error) { failures.push(error); }
    }
    for (const target of this._timelineTargets.keys()) {
      try {
        target.removeAttribute(VIDEO_SKIP_TIMELINE_TARGET_ATTRIBUTE);
        this._timelineTargets.delete(target);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw createLifecycleError('VIDEO_SKIP_CONTROL_SURFACE_TIMELINE_TARGET_REMOVE_FAILED', failures);
    }
  }

  _findTrackedVideoForPlayerRoot(playerRoot) {
    for (const video of this._trackedVideos) {
      if (video.isConnected === false) continue;
      if (this._videoPlayerOwnership.get(video)?.playerRoot === playerRoot) return video;
      if (playerRoot === video || playerRoot.contains(video)) return video;
      let root = this._videoRoots.get(video) || null;
      while (isMediaShadowRoot(root)) {
        const host = root.host;
        if (playerRoot === host || playerRoot.contains(host)) return video;
        root = host.getRootNode?.() || null;
      }
    }
    return null;
  }

  _resolveTrackedTimelineTarget(event) {
    if (
      (event?.type === 'pointermove' || event?.type === 'mousemove')
      && !(Number(event?.buttons) > 0)
    ) {
      return null;
    }
    const pathElements = getEventPathElements(event);
    if (pathElements.some((element) => (
      matchesSelector(element, this.profile.excludedTargetSelector)
    ))) {
      return null;
    }
    const timelineTarget = pathElements.find((element) => (
      matchesSelector(element, this.profile.timelineTargetSelector)
    ));
    if (!timelineTarget) return null;
    const admittedVideo = this._timelineTargets.get(timelineTarget) || null;
    const admittedOwnership = admittedVideo
      ? this._videoPlayerOwnership.get(admittedVideo) || null
      : null;
    if (admittedVideo && admittedOwnership && this._trackedVideos.has(admittedVideo)) {
      return Object.freeze({
        playerRoot: admittedOwnership.playerRoot,
        timelineTarget,
        video: admittedVideo,
      });
    }

    let playerRoot = pathElements.find((element) => (
      matchesSelector(element, this.profile.playerRootSelector)
    )) || null;
    let video = playerRoot ? this._findTrackedVideoForPlayerRoot(playerRoot) : null;
    if (!video) {
      for (const candidate of this._trackedVideos) {
        const ownership = this._videoPlayerOwnership.get(candidate) || null;
        if (!ownership?.scope?.contains?.(timelineTarget)) continue;
        video = candidate;
        playerRoot = ownership.playerRoot;
        break;
      }
    }
    if (!playerRoot) return null;
    if (!video) return null;
    if (!this._admitTimelineTarget(timelineTarget, playerRoot, video)) return null;
    return Object.freeze({ playerRoot, timelineTarget, video });
  }

  _clearLockProjection() {
    this._document?.documentElement?.removeAttribute?.(VIDEO_SKIP_TIMELINE_LOCK_ATTRIBUTE);
    this._appliedLockKey = null;
  }

  _onInput(event) {
    try {
      // Hover cannot seek. Root/mutation and policy owners already reconcile
      // the projection; ordinary mouse movement must not sweep every player.
      if ((event?.type === 'pointermove' || event?.type === 'mousemove')
        && !(Number(event.buttons) > 0)) return;
      if (this._handledInputEvents.has(event) || this.shouldDeferGestureToRoot(event)) return;
      if (isMediaShadowRoot(event.currentTarget)) this._onObservedGesture?.(event);
      const state = this.sync();
      if (!state.locked) return;
      const isKeyboardInput = event?.type === 'keydown';
      const timelineTarget = isKeyboardInput
        ? null
        : this._resolveTrackedTimelineTarget(event);
      const shouldBlock = isKeyboardInput
        ? this._isKeyboardSeekInput(event)
        : !!timelineTarget;
      if (!shouldBlock) return;

      this._handledInputEvents.add(event);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this._onBlockedInput({
        profileId: this.profile.id,
        siteId: this.profile.siteId,
        eventType: event.type,
        inputKind: isKeyboardInput ? 'seek_keyboard' : 'timeline_pointer',
        lockReason: state.reason,
        unlockAt: state.unlockAt,
        video: timelineTarget?.video || null,
        attempt: {
          type: event.type,
          pointerId: event.pointerId,
          repeat: event.repeat === true,
        },
      });
    } catch (error) {
      this._onFailure(error, {
        phase: 'input_block',
        eventName: event?.type || null,
        profileId: this.profile.id,
      });
    }
  }
}

export default VideoSkipControlSurfaceRuntime;
