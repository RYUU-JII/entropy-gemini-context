import { readMediaShadowRoot } from './mediaShadowRootAccess.js';

const TAB_MEDIA_SELECTOR = 'video, audio';
const TAB_AUDIO_SELECTOR = 'audio';
const mediaObservationExcludedNodes = new WeakSet();

export function registerMediaObservationExcludedNode(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('MEDIA_OBSERVATION_EXCLUDED_NODE_REQUIRED');
  }
  mediaObservationExcludedNodes.add(value);
  return () => mediaObservationExcludedNodes.delete(value);
}

export function isQueryableRoot(value) {
  return value && typeof value.querySelectorAll === 'function';
}

export function isTabMediaElement(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof HTMLMediaElement !== 'undefined' && value instanceof HTMLMediaElement) return true;
  const tagName = String(value.tagName || '').toLowerCase();
  return tagName === 'video' || tagName === 'audio';
}

export function isTabAudioElement(value) {
  return isTabMediaElement(value)
    && String(value.tagName || '').toLowerCase() === 'audio';
}

export function isMediaObservationExcludedNode(value) {
  if (!value || typeof value !== 'object') return false;
  let current = value;
  for (let depth = 0; current && depth < 64; depth += 1) {
    if (mediaObservationExcludedNodes.has(current)) return true;
    current = current.parentNode || current.host || null;
  }
  return false;
}

function getOpenShadowRoot(node) {
  if (!node || typeof node !== 'object') return null;
  const root = readMediaShadowRoot(node);
  return isQueryableRoot(root) ? root : null;
}

export function collectOpenShadowRootsFromNode(node, target = [], seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || isMediaObservationExcludedNode(node)) return target;

  const visitCandidate = (candidate) => {
    if (isMediaObservationExcludedNode(candidate)) return;
    const root = getOpenShadowRoot(candidate);
    if (!root || seen.has(root) || isMediaObservationExcludedNode(root)) return;
    seen.add(root);
    target.push(root);
    collectOpenShadowRootsFromNode(root, target, seen);
  };

  visitCandidate(node);
  if (!isQueryableRoot(node)) return target;
  node.querySelectorAll('*').forEach(visitCandidate);
  return target;
}

function addMediaFromRoot(root, target, seen, {
  selector = TAB_MEDIA_SELECTOR,
  predicate = isTabMediaElement,
} = {}) {
  if (isMediaObservationExcludedNode(root)) return;
  if (predicate(root) && !seen.has(root)) {
    seen.add(root);
    target.push(root);
  }
  if (!isQueryableRoot(root)) return;
  root.querySelectorAll(selector).forEach((element) => {
    if (
      !predicate(element)
      || isMediaObservationExcludedNode(element)
      || seen.has(element)
    ) return;
    seen.add(element);
    target.push(element);
  });
}

export function collectTabMediaElements({
  documentRef = typeof document !== 'undefined' ? document : null,
  root = null,
} = {}) {
  const scanRoot = root || documentRef;
  if (!isQueryableRoot(scanRoot)) throw new Error('PAGE_MEDIA_COLLECTION_ROOT_REQUIRED');
  const media = [];
  const seen = new Set();
  try {
    addMediaFromRoot(scanRoot, media, seen);
    collectOpenShadowRootsFromNode(scanRoot).forEach((shadowRoot) => {
      addMediaFromRoot(shadowRoot, media, seen);
    });
  } catch (cause) {
    throw new Error('PAGE_MEDIA_COLLECTION_FAILED', { cause });
  }
  return media;
}

export function collectTabAudioElements({
  documentRef = typeof document !== 'undefined' ? document : null,
  root = null,
} = {}) {
  const scanRoot = root || documentRef;
  if (!isQueryableRoot(scanRoot)) throw new Error('PAGE_MEDIA_COLLECTION_ROOT_REQUIRED');
  const audio = [];
  const seen = new Set();
  try {
    addMediaFromRoot(scanRoot, audio, seen, {
      selector: TAB_AUDIO_SELECTOR,
      predicate: isTabAudioElement,
    });
    collectOpenShadowRootsFromNode(scanRoot).forEach((shadowRoot) => {
      addMediaFromRoot(shadowRoot, audio, seen, {
        selector: TAB_AUDIO_SELECTOR,
        predicate: isTabAudioElement,
      });
    });
  } catch (cause) {
    throw new Error('PAGE_MEDIA_COLLECTION_FAILED', { cause });
  }
  return audio;
}

export function isPlayingTabMediaElement(element) {
  return isTabMediaElement(element)
    && element.paused === false
    && element.ended !== true;
}

export function collectPlayingTabMediaElements(options = {}) {
  return collectTabMediaElements(options).filter(isPlayingTabMediaElement);
}

// Kept only while a local media lease exists; never serialized or persisted.
// A recycled HTMLMediaElement is not permission to resume its next source.
export function readMediaSourceIdentity(element) {
  return {
    currentSrc: element.currentSrc,
    src: element.getAttribute('src'),
    srcObject: element.srcObject,
    sources: Array.from(element.querySelectorAll('source'), (source) => ({
      element: source,
      src: source.getAttribute('src'),
      type: source.getAttribute('type'),
      media: source.getAttribute('media'),
    })),
  };
}

export function matchesMediaSourceIdentity(element, identity) {
  const current = readMediaSourceIdentity(element);
  return current.currentSrc === identity.currentSrc
    && current.src === identity.src
    && current.srcObject === identity.srcObject
    && current.sources.length === identity.sources.length
    && current.sources.every((source, index) => {
      const previous = identity.sources[index];
      return source.element === previous.element && source.src === previous.src
        && source.type === previous.type && source.media === previous.media;
    });
}
