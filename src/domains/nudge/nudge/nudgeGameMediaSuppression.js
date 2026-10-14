// Page media handling for the sentinel protocol overlay. The ritual cannot
// coexist with the page's soundtrack: site furin submerges the audio (the
// pond closing over it — volume sinks, then the stream pauses), the global
// sentinel seizes the stream outright. Restore semantics carry the protocol's
// meaning: only an explicit resume restore mode can resume entry-time playback.
// Terminal outcome policy remains with the protocol owner.
//
// Playback reach and resume eligibility belong to the shared PageMediaHold.
// Cross-origin frames require a separately authorized media command owner.

import { matchesMediaSourceIdentity, readMediaSourceIdentity } from '../media/pageMediaElements.js';
import { createPageMediaHold } from '../media/PageMediaHold.js';

export const SENTINEL_MEDIA_SUPPRESS_MODES = Object.freeze({
  // site furin: volume sinks underwater over ~1s, then the stream pauses
  SUBMERGE: 'submerge',
  // global sentinel: hard stop — the simulation takes the stream
  SEIZE: 'seize',
});

export const SENTINEL_MEDIA_RESTORE_MODES = Object.freeze({
  // user chose to continue: playback rises back gently from silence
  SURFACE: 'surface',
  // global resync failure: content resumes on its own (the poisoned reward)
  RESUME: 'resume',
  // leave/teardown: volumes restored, playback stays stopped
  RELEASE: 'release',
});

const SUBMERGE_FADE_MS = 1100;
const SURFACE_RAMP_MS = 2600;
const FADE_STEP_MS = 80;
const RESUME_GLITCH_MS = 560;
const RESUME_GLITCH_ROOT_ID = 'entropy-sentinel-media-resume-glitch';

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error('SENTINEL_MEDIA_VOLUME_INVALID');
  return Math.max(0, Math.min(1, numeric));
}

export function createSentinelMediaSuppressor({
  documentRef = typeof document !== 'undefined' ? document : null,
  windowRef = typeof window !== 'undefined' ? window : null,
  onDiagnostic = console.warn,
} = {}) {
  if (!documentRef?.documentElement || !windowRef?.setInterval || !windowRef?.clearInterval) {
    throw new Error('SENTINEL_MEDIA_ENVIRONMENT_REQUIRED');
  }
  const hold = createPageMediaHold({ documentRef, onDiagnostic });
  let entries = [];
  let suppressed = false;
  let fadeTimer = null;
  let fadingEntries = [];
  let volumeFailureCount = 0;
  let resumeGlitchTimer = null;
  let resumeGlitchRoot = null;

  function clearFadeTimer({ restoreOwnedVolume = false } = {}) {
    if (fadeTimer !== null) windowRef.clearInterval(fadeTimer);
    fadeTimer = null;
    const previousEntries = fadingEntries;
    fadingEntries = [];
    if (restoreOwnedVolume) previousEntries.forEach(restoreEntryVolume);
  }

  function clearResumeGlitch() {
    if (resumeGlitchTimer !== null) {
      windowRef?.clearTimeout(resumeGlitchTimer);
      resumeGlitchTimer = null;
    }
    const existing = documentRef?.getElementById?.(RESUME_GLITCH_ROOT_ID) || null;
    if (existing && existing !== resumeGlitchRoot) existing.remove();
    resumeGlitchRoot?.remove();
    resumeGlitchRoot = null;
  }

  function pulseResumeGlitch() {
    if (!documentRef?.createElement || !documentRef?.documentElement || !windowRef) return;
    clearResumeGlitch();
    resumeGlitchRoot = documentRef.createElement('div');
    resumeGlitchRoot.id = RESUME_GLITCH_ROOT_ID;
    resumeGlitchRoot.setAttribute('aria-hidden', 'true');
    resumeGlitchRoot.style.position = 'fixed';
    resumeGlitchRoot.style.inset = '0';
    resumeGlitchRoot.style.pointerEvents = 'none';
    resumeGlitchRoot.style.zIndex = '2147483646';
    const shadow = resumeGlitchRoot.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        @keyframes poisonedRewardSnap {
          0% { opacity: 0; transform: translate3d(0, 0, 0); filter: contrast(1); }
          8% { opacity: 0.92; transform: translate3d(-1.2%, 0, 0); filter: contrast(1.9); }
          15% { opacity: 0.42; transform: translate3d(1.8%, -0.2%, 0); }
          24% { opacity: 0.78; transform: translate3d(-0.8%, 0.3%, 0); }
          34% { opacity: 0.18; transform: translate3d(0.4%, 0, 0); }
          100% { opacity: 0; transform: translate3d(0, 0, 0); filter: contrast(1); }
        }
        .snap {
          position: fixed;
          inset: 0;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.18) 38%, rgba(15, 23, 42, 0.16)),
            repeating-linear-gradient(180deg, rgba(15, 23, 42, 0.32) 0 1px, transparent 1px 4px);
          mix-blend-mode: screen;
          animation: poisonedRewardSnap ${RESUME_GLITCH_MS}ms steps(1, end) forwards;
        }
        .snap::before,
        .snap::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .snap::before {
          background:
            linear-gradient(90deg, rgba(56, 189, 248, 0.38), transparent 18%, transparent 80%, rgba(248, 113, 113, 0.36)),
            linear-gradient(180deg, transparent 0 36%, rgba(255, 255, 255, 0.72) 36% 37%, transparent 37% 100%);
          transform: translateX(-1.6%);
          mix-blend-mode: screen;
        }
        .snap::after {
          background:
            radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(2, 6, 23, 0.32) 100%),
            linear-gradient(90deg, transparent 0 46%, rgba(15, 23, 42, 0.28) 46% 48%, transparent 48% 100%);
          mix-blend-mode: multiply;
        }
      </style>
      <div class="snap"></div>
    `;
    documentRef.documentElement.appendChild(resumeGlitchRoot);
    resumeGlitchTimer = windowRef.setTimeout(clearResumeGlitch, RESUME_GLITCH_MS);
  }

  function trackElement(element) {
    try {
      entries.push({
        element,
        volume: clamp01(element.volume),
        source: readMediaSourceIdentity(element),
        isInOriginalScope: hold.captureMediaScope(element),
        lastWrittenVolume: null,
        volumeOwned: true,
      });
    } catch (error) { reportVolumeFailure(error); }
  }

  function reportVolumeFailure(error) {
    volumeFailureCount += 1;
    onDiagnostic('[sentinel media] volume operation failed', {
      code: 'SENTINEL_MEDIA_VOLUME_FAILED', name: error.name,
    });
  }

  function setEntryVolume(entry, volume) {
    if (!entry.volumeOwned || entry.element.isConnected === false) return false;
    try {
      const expectedVolume = entry.lastWrittenVolume === null ? entry.volume : entry.lastWrittenVolume;
      if (!entry.isInOriginalScope() || !matchesMediaSourceIdentity(entry.element, entry.source) || entry.element.volume !== expectedVolume) {
        entry.volumeOwned = false;
        return false;
      }
      const nextVolume = clamp01(volume);
      entry.element.volume = nextVolume;
      if (entry.element.volume !== nextVolume) throw new Error('SENTINEL_MEDIA_VOLUME_WRITE_UNCONFIRMED');
      entry.lastWrittenVolume = nextVolume;
      return true;
    } catch (error) {
      entry.volumeOwned = false;
      reportVolumeFailure(error);
      return false;
    }
  }

  function restoreEntryVolume(entry) {
    if (entry.lastWrittenVolume !== null) setEntryVolume(entry, entry.volume);
  }

  // Fade every item's volume from its current level toward `resolveTarget`,
  // then hand off to `onDone`. One shared timer drives all items.
  function runVolumeFade(items, durationMs, resolveTarget, onDone) {
    clearFadeTimer();
    if (items.length === 0 || durationMs <= 0) {
      items.forEach((item) => setEntryVolume(item, resolveTarget(item)));
      onDone?.(items);
      return;
    }
    const startedVolumes = items.map((item) => item.lastWrittenVolume === null ? item.volume : item.lastWrittenVolume);
    fadingEntries = items;
    let elapsed = 0;
    fadeTimer = windowRef.setInterval(() => {
      elapsed += FADE_STEP_MS;
      const t = Math.min(1, elapsed / durationMs);
      items.forEach((item, index) => {
        const target = resolveTarget(item);
        setEntryVolume(item, startedVolumes[index] + (target - startedVolumes[index]) * t);
      });
      if (t >= 1) {
        clearFadeTimer();
        onDone?.(items);
      }
    }, FADE_STEP_MS);
  }

  function suppress({ mode = SENTINEL_MEDIA_SUPPRESS_MODES.SUBMERGE } = {}) {
    if (!Object.values(SENTINEL_MEDIA_SUPPRESS_MODES).includes(mode)) throw new Error('SENTINEL_MEDIA_SUPPRESS_MODE_INVALID');
    if (suppressed) return getSuppressionResult();
    clearFadeTimer({ restoreOwnedVolume: true });
    entries = [];
    volumeFailureCount = 0;
    hold.suppress({ deferPause: true });
    suppressed = true;
    hold.getInitiallyPlayingMedia().forEach(trackElement);
    if (mode === SENTINEL_MEDIA_SUPPRESS_MODES.SEIZE) {
      hold.pauseTracked();
    } else {
      runVolumeFade(entries, SUBMERGE_FADE_MS, () => 0, () => hold.pauseTracked());
    }
    return getSuppressionResult();
  }

  function getSuppressionResult() {
    const snapshot = hold.snapshot();
    return { matchedCount: snapshot.trackedCount, suppressedCount: snapshot.blockedPlays, failedCount: snapshot.failedCount + volumeFailureCount };
  }

  function restore({ mode = SENTINEL_MEDIA_RESTORE_MODES.RELEASE } = {}) {
    if (!suppressed) {
      // A failed initial suppress may still own an exact cleanup retry lease.
      hold.restore();
      return { restoredCount: 0 };
    }
    if (!Object.values(SENTINEL_MEDIA_RESTORE_MODES).includes(mode)) throw new Error('SENTINEL_MEDIA_RESTORE_MODE_INVALID');
    clearFadeTimer({ restoreOwnedVolume: true });
    const restorable = entries.filter((entry) => entry.element?.isConnected !== false);
    restorable.forEach(restoreEntryVolume);
    const byElement = new Map(restorable.map((entry) => [entry.element, entry]));
    const rampEntries = [];
    if (mode === SENTINEL_MEDIA_RESTORE_MODES.SURFACE) {
      hold.restore({ resume: true, beforeResume: (element) => {
        const entry = byElement.get(element);
        if (entry && setEntryVolume(entry, 0)) rampEntries.push(entry);
      } });
      runVolumeFade(rampEntries, SURFACE_RAMP_MS, (entry) => entry.volume, null);
    } else if (mode === SENTINEL_MEDIA_RESTORE_MODES.RESUME) {
      hold.restore({ resume: true });
      if (hold.snapshot().resumeRequestedCount > 0) pulseResumeGlitch();
    } else {
      hold.restore();
    }
    const restoredCount = restorable.length;
    entries = [];
    suppressed = false;
    return { restoredCount };
  }

  function dispose() {
    if (suppressed) restore();
    else hold.restore();
    clearFadeTimer({ restoreOwnedVolume: true });
    clearResumeGlitch();
    entries = [];
    suppressed = false;
  }

  function isSuppressed() {
    return suppressed;
  }

  return {
    suppress,
    restore,
    dispose,
    isSuppressed,
    whenSettled: () => hold.whenSettled(),
    snapshot: () => ({ ...hold.snapshot(), volumeFailureCount }),
  };
}
