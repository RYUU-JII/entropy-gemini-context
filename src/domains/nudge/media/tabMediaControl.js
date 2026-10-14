// Same-document media controls shared by ritual surfaces that need to pull the
// user away from page playback. Cross-origin frames need their own content
// runtime; this utility intentionally controls only reachable video/audio nodes.

import {
  collectPlayingTabMediaElements,
  collectTabMediaElements,
  isPlayingTabMediaElement,
  isTabMediaElement,
} from './pageMediaElements.js';

export {
  collectPlayingTabMediaElements,
  collectTabMediaElements,
  isPlayingTabMediaElement,
  isTabMediaElement,
};

export function pauseTabMediaElement(element) {
  if (!isTabMediaElement(element) || typeof element.pause !== 'function') {
    return { ok: false, reason: 'not_pauseable_media' };
  }
  try {
    element.pause();
    if (element.paused !== true) {
      return { ok: false, reason: 'pause_unconfirmed' };
    }
    return { ok: true, reason: 'paused' };
  } catch (error) {
    return {
      ok: false,
      reason: 'pause_failed',
      error: String(error?.message || error || 'MEDIA_PAUSE_FAILED'),
    };
  }
}

export function pausePlayingTabMedia(options = {}) {
  const media = collectTabMediaElements(options);
  let matchedCount = 0;
  let pausedCount = 0;
  let failedCount = 0;
  const failures = [];
  media.forEach((element) => {
    try {
      if (!isPlayingTabMediaElement(element)) return;
      matchedCount += 1;
    } catch (error) {
      failedCount += 1;
      failures.push({ ok: false, reason: 'media_state_read_failed', error: String(error.message) });
      return;
    }
    const result = pauseTabMediaElement(element);
    if (result.ok) {
      pausedCount += 1;
      return;
    }
    failedCount += 1;
    failures.push(result);
  });
  return {
    discoveredCount: media.length,
    matchedCount,
    pausedCount,
    failedCount,
    failures,
  };
}
