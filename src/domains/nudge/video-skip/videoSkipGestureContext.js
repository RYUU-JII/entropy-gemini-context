import { isObservedVideoElement } from '../video/VideoElementObserver.js';

function isElement(value) {
    return value?.nodeType === 1 && typeof value.getAttribute === 'function' && typeof value.contains === 'function';
}

const MEDIA_CONTAINER_ANCESTOR_LIMIT = 5;
const MEDIA_GESTURE_START_EVENTS = Object.freeze(['pointerdown', 'mousedown', 'touchstart']);
const MEDIA_GESTURE_END_EVENTS = Object.freeze(['pointerup', 'mouseup', 'touchend']);
const MEDIA_SEEK_KEY_VALUES = Object.freeze([
    'ArrowLeft',
    'ArrowRight',
    'PageDown',
    'PageUp',
    'Home',
    'End',
    'MediaTrackNext',
    'MediaTrackPrevious',
    ',',
    '.',
    'j',
    'l',
]);
const MEDIA_SEEK_KEY_CODES = Object.freeze([
    'ArrowLeft',
    'ArrowRight',
    'PageDown',
    'PageUp',
    'Home',
    'End',
    'Comma',
    'Period',
    'KeyJ',
    'KeyL',
]);

function elementContains(root, node) {
    if (!isElement(root) || !isElement(node)) return false;
    let candidate = node;
    while (candidate) {
        if (root === candidate || root.contains(candidate)) return true;
        candidate = candidate.getRootNode?.()?.host || null;
    }
    return false;
}

function composedParent(element) {
    return element.parentElement || element.getRootNode?.()?.host || null;
}

export function resolveVideoSkipGestureVideo({ event, trackedVideos, activeVideo, documentRef = document }) {
    const videos = Array.from(trackedVideos || []).filter((video) => video.isConnected !== false);
    const path = getEventPathElements(event);
    const direct = path.filter((entry) => videos.includes(entry));
    if (direct.length === 1) return direct[0];
    const linked = videos.filter((video) => video.id && path.some((entry) => (
        entry.getAttribute('aria-controls') === video.id
    )));
    if (linked.length === 1) return linked[0];
    if (linked.length > 1) return null;
    const target = path[0] || event?.target;
    const candidates = [];
    for (const video of videos) {
        let ancestor = composedParent(video);
        for (let depth = 0; ancestor && depth < MEDIA_CONTAINER_ANCESTOR_LIMIT; depth += 1) {
            if (ancestor === documentRef.body || ancestor === documentRef.documentElement) break;
            if (elementContains(ancestor, target)) {
                candidates.push({ video, depth });
                break;
            }
            ancestor = composedParent(ancestor);
        }
    }
    if (candidates.length > 0) {
        const depth = Math.min(...candidates.map((entry) => entry.depth));
        const nearest = candidates.filter((entry) => entry.depth === depth);
        return nearest.length === 1 ? nearest[0].video : null;
    }
    if (isPotentialMediaSeekKey(event) && !isEditableGestureTarget(target)
        && (target === documentRef.body || target === documentRef.documentElement)
        && videos.includes(activeVideo)) return activeVideo;
    return null;
}

function getEventPathElements(event) {
    if (typeof event?.composedPath !== 'function') return [];
    return event.composedPath().filter(isElement);
}

function findGestureVideoTarget(event, target) {
    const pathVideo = getEventPathElements(event)
        .find(isObservedVideoElement);
    if (pathVideo) return pathVideo;
    if (isObservedVideoElement(target)) return target;
    const closest = typeof target?.closest === 'function' ? target.closest('video') : null;
    return isObservedVideoElement(closest) ? closest : null;
}

function isActiveVideoContainerGesture(target, activeVideo, documentRef) {
    if (!target || !activeVideo || !documentRef) return false;
    let ancestor = composedParent(activeVideo);
    let depth = 0;
    while (
        ancestor
        && ancestor !== documentRef.body
        && ancestor !== documentRef.documentElement
    ) {
        if (elementContains(ancestor, target)) return true;
        depth += 1;
        if (depth >= MEDIA_CONTAINER_ANCESTOR_LIMIT) break;
        ancestor = composedParent(ancestor);
    }
    return false;
}

function isEditableGestureTarget(target) {
    if (!isElement(target)) return false;
    const tagName = String(target.tagName || '').toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
    if (target.isContentEditable === true) return true;
    const role = target.getAttribute?.('role');
    return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}

function isPotentialMediaSeekKey(event) {
    if (event?.type !== 'keydown') return false;
    const key = typeof event.key === 'string' ? event.key : '';
    const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
    const code = typeof event.code === 'string' ? event.code : '';
    return MEDIA_SEEK_KEY_VALUES.includes(normalizedKey)
        || MEDIA_SEEK_KEY_CODES.includes(code)
        || /^Digit[0-9]$/.test(code)
        || /^[0-9]$/.test(key);
}

function isKeyboardMediaSeekGesture(event, target, {
    activeVideo,
    fullscreenContainsActiveVideo,
    sharedActiveVideoContainer,
    trackedTargetVideo,
    documentRef,
} = {}) {
    if (!activeVideo) return false;
    if (!isPotentialMediaSeekKey(event)) return false;
    if (isEditableGestureTarget(target)) return false;
    const targetIsDocumentSurface = !!documentRef
        && (target === documentRef.body || target === documentRef.documentElement);
    return !!(
        fullscreenContainsActiveVideo
        || sharedActiveVideoContainer
        || trackedTargetVideo
        || targetIsDocumentSurface
    );
}

const AD_TARGET_SELECTOR = ':is('
    + '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, '
    + '.ytp-ad-overlay-container, .ytp-ad-player-overlay, .ytp-ad-text, '
    + '.ytp-ad-preview-container, .ytp-ad-module, .ytp-ad-action-interstitial, '
    + '.video-ads, [class*="ad-skip" i], [class*="skip-ad" i], '
    + '[id*="ad-skip" i], [id*="skip-ad" i], '
    + '[aria-label*="skip ad" i], [aria-label*="광고 건너뛰기" i]'
    + ')';

const AD_CONTAINER_SELECTOR = ':is('
    + '.ad-showing, .ad-interrupting, '
    + '[class*="ad-showing" i], [class*="ad-interrupting" i]'
    + ')';

export function isAdGestureTarget(target) {
    if (!isElement(target)) return false;
    if (typeof target.closest !== 'function') return false;
    if (target.closest(AD_TARGET_SELECTOR)) return true;
    if (target.closest(AD_CONTAINER_SELECTOR)) return true;
    return false;
}

export function buildVideoSkipUserGestureContext({
    event,
    now = Date.now(),
    activeVideo = null,
    trackedVideos = null,
    fullscreenElement = null,
    mediaGestureHoldUntil = 0,
    documentRef = typeof document !== 'undefined' ? document : null,
} = {}) {
    const pathTarget = getEventPathElements(event)[0];
    const target = pathTarget || (isElement(event?.target)
        ? event.target : null);
    const isAdTarget = isAdGestureTarget(target);
    const isTrackedVideo = (video) => !!video
        && !!trackedVideos
        && typeof trackedVideos.has === 'function'
        && trackedVideos.has(video);
    const trackedActiveVideo = isObservedVideoElement(activeVideo)
        && isTrackedVideo(activeVideo)
        ? activeVideo
        : null;
    const targetVideo = !isAdTarget ? findGestureVideoTarget(event, target) : null;
    const fullscreenContainsTarget = !!fullscreenElement && !!target
        && elementContains(fullscreenElement, target);
    const fullscreenContainsActiveVideo = !!fullscreenElement && !!trackedActiveVideo
        && elementContains(fullscreenElement, trackedActiveVideo);
    const trackedTargetVideo = isTrackedVideo(targetVideo);
    const sharedActiveVideoContainer = !isAdTarget && isActiveVideoContainerGesture(
        target,
        trackedActiveVideo,
        documentRef,
    );
    const keyboardMediaSeek = !isAdTarget && isKeyboardMediaSeekGesture(event, target, {
        activeVideo: trackedActiveVideo,
        fullscreenContainsActiveVideo,
        sharedActiveVideoContainer,
        trackedTargetVideo,
        documentRef,
    });
    const eventType = event?.type || '';
    const dragMediaSeek = !isAdTarget
        && MEDIA_GESTURE_END_EVENTS.includes(eventType)
        && Number(mediaGestureHoldUntil) > now;
    const mediaGestureBase = eventType === 'keydown' ? keyboardMediaSeek : trackedTargetVideo || (
        fullscreenContainsTarget
        && fullscreenContainsActiveVideo
        && !isAdTarget
    ) || sharedActiveVideoContainer;
    const mediaSeekContext = mediaGestureBase || dragMediaSeek;

    return {
        targetTagName: target ? String(target.tagName || '').toLowerCase() : null,
        targetRole: target?.getAttribute?.('role') || null,
        targetVideo: trackedTargetVideo,
        fullscreenActive: !!fullscreenElement,
        fullscreenContainsTarget,
        activeVideoInFullscreen: fullscreenContainsActiveVideo,
        sharedActiveVideoContainer,
        keyboardMediaSeek,
        dragMediaSeek,
        mediaGestureBase,
        mediaSeekContext,
        isAdTarget,
    };
}

export function resolveVideoSkipMediaGestureHoldUntil({
    eventType = '',
    context = null,
    now = Date.now(),
    currentHoldUntil = 0,
    mediaSeekGestureWindowMs,
} = {}) {
    const windowMs = Math.max(0, Number(mediaSeekGestureWindowMs) || 0);
    if (MEDIA_GESTURE_START_EVENTS.includes(eventType)) {
        return context?.mediaGestureBase === true ? now + windowMs : 0;
    }
    if (
        MEDIA_GESTURE_END_EVENTS.includes(eventType)
        && context?.mediaSeekContext === true
    ) {
        return now + windowMs;
    }
    return currentHoldUntil;
}

export function isVideoSkipUserGestureRecent({
    lastGestureTs,
    now = Date.now(),
    userGestureWindowMs,
} = {}) {
    const timestamp = Math.max(0, Number(lastGestureTs) || 0);
    const windowMs = Math.max(0, Number(userGestureWindowMs) || 0);
    return timestamp > 0 && now - timestamp < windowMs;
}

export function isVideoSkipMediaSeekGestureRecent({
    lastGestureTs,
    lastGesture,
    now = Date.now(),
    mediaSeekGestureWindowMs,
} = {}) {
    const timestamp = Math.max(0, Number(lastGestureTs) || 0);
    if (!(timestamp > 0)) return false;
    if (lastGesture?.mediaSeekContext !== true) return false;
    const windowMs = Math.max(0, Number(mediaSeekGestureWindowMs) || 0);
    return now - timestamp < windowMs;
}

export function buildVideoSkipGestureDiagnostics({
    lastGestureTs,
    lastGesture,
    now = Date.now(),
    userGestureWindowMs,
    mediaSeekGestureWindowMs,
} = {}) {
    const timestamp = Math.max(0, Number(lastGestureTs) || 0);
    const gestureAgeMs = timestamp > 0
        ? Math.max(0, Math.floor(now - timestamp))
        : null;
    const baseUserGestureRecent = isVideoSkipUserGestureRecent({
        lastGestureTs: timestamp,
        now,
        userGestureWindowMs,
    });
    const mediaSeekGestureRecent = isVideoSkipMediaSeekGestureRecent({
        lastGestureTs: timestamp,
        lastGesture,
        now,
        mediaSeekGestureWindowMs,
    });
    return {
        userGestureRecent: baseUserGestureRecent || mediaSeekGestureRecent,
        baseUserGestureRecent,
        mediaSeekGestureRecent,
        gestureAgeMs,
        userGestureWindowMs,
        mediaSeekGestureWindowMs,
        lastGesture: lastGesture
            ? {
                ...lastGesture,
                ageMs: gestureAgeMs,
            }
            : null,
    };
}
