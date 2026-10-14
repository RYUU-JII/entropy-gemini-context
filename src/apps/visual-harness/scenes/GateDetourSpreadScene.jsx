import React from 'react';

import { GateDetourSpreadSurface } from '../../gate/GateInterstitialApp.jsx';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../gate/gate.css';

function createFaviconDataUrl({ background, foreground = '#ffffff', label }) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<rect width="64" height="64" rx="16" fill="${background}"/>`,
    `<text x="32" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="${foreground}">${label}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/*
 * Freeze the scene at one instant of its sequence.
 *
 * Two things have to be defeated for this to be reproducible. Waiting the
 * sequence out on a timer does not work, because setTimeout is clamped and
 * rescheduled under load while the animation clock keeps to wall time. And
 * pausing does not work either, because the capture runner screenshots with
 * Playwright's `animations: 'disabled'`, which fast-forwards every finite CSS
 * animation to its end frame first — which is why asking for 1020ms returned
 * the finished state whether or not the clock had been pinned.
 *
 * So the frame is seeked, committed to inline style, and the animation then
 * cancelled: by capture time there is no animation left to fast-forward, only
 * the styles the sequence would have had at that millisecond.
 */
function freezeAnimationsAtFrame(frameMs, { settleScene = false } = {}) {
  if (typeof document.getAnimations !== 'function') {
    return false;
  }
  document.getAnimations().forEach((animation) => {
    try {
      const target = animation.effect.target;
      const isFlight = target?.classList.contains('gate-tab-flight');
      const isIntake = target?.classList.contains('zen-predator-intake__light');
      animation.currentTime = settleScene && !isFlight && !isIntake ? 2500 : frameMs;
      animation.commitStyles();
      if (isFlight) {
        // A still retains the committed flight while production cancellation
        // correctly disposes its live ghost and restores the destination.
        target.parentElement.append(target.cloneNode(true));
      }
      animation.cancel();
    } catch (_) {
      // Pseudo-element effects cannot be committed; the runner's own
      // animation handling settles those and they carry no sequence state.
    }
  });
  return true;
}

export const GATE_DETOUR_SPREAD_SESSION = Object.freeze({
  sessionId: 'visual-gate-detour-spread',
  tabId: 105,
  gateKind: 'detourSpreadGuard',
  originalUrl: 'https://video.example/watch/entropy',
  hostname: 'video.example',
  severity: 'mid',
  planLevel: 3,
  themeId: 'zen',
  gatekeeperStyleVariant: 'zen',
  metrics: Object.freeze({
    protectedTabThreshold: 4,
  }),
  protectedTabs: Object.freeze([
    Object.freeze({
      tabId: 101,
      hostname: 'stream.example',
      url: 'https://stream.example/home',
      title: 'Stream',
      favIconUrl: createFaviconDataUrl({ background: '#ff0033', label: 'S' }),
    }),
    Object.freeze({
      tabId: 102,
      hostname: 'forum.example',
      url: 'https://forum.example/popular',
      title: 'Forum',
      favIconUrl: createFaviconDataUrl({ background: '#ff5a1f', label: 'F' }),
    }),
    Object.freeze({
      tabId: 103,
      hostname: 'social.example',
      url: 'https://social.example/feed',
      title: 'Social',
      favIconUrl: createFaviconDataUrl({ background: '#111827', label: 'X' }),
    }),
    Object.freeze({
      tabId: 104,
      hostname: 'photos.example',
      url: 'https://photos.example/explore',
      title: 'Photos',
      favIconUrl: createFaviconDataUrl({ background: '#a855f7', label: 'P' }),
    }),
    Object.freeze({
      tabId: 105,
      hostname: 'video.example',
      url: 'https://video.example/watch/entropy',
      title: 'Video',
      favIconUrl: createFaviconDataUrl({ background: '#2563eb', label: 'V' }),
      active: true,
    }),
  ]),
});

export function GateDetourSpreadDemo({
  autoSelectTabId = null,
  autoSelectTabIds = null,
  captureAtMs = null,
  transferAtMs = null,
  language = 'en',
  pendingDecision = '',
  presentation = 'blocking',
  tutorialCompleted = true,
  signalReady = null,
}) {
  const surfaceRef = React.useRef(null);
  const initialSelection = React.useMemo(() => (
    Array.isArray(autoSelectTabIds) ? autoSelectTabIds : []
  ), [autoSelectTabIds]);
  const [selectedTabIdsToClose, setSelectedTabIdsToClose] = React.useState(initialSelection);

  /*
   * captureAtMs pins the capture to a chosen point inside a running sequence.
   * The closing sequence is only reachable through a submit that immediately
   * tears the surface down in the product, so a still of it exists only if the
   * harness is told when to look.
   *
   * Signalling ready at the target time is not enough: the runner still has to
   * settle the surface and take the shot, and the sequence keeps playing while
   * it does, so the frame that lands is several hundred milliseconds late and
   * drifts with machine load. Freezing every animation first makes the capture
   * time-independent — whatever moment is asked for is the moment recorded.
   */
  React.useEffect(() => {
    if (Number.isFinite(captureAtMs)) {
      let cancelled = false;
      // Two frames, so the animations named by the closing rules exist to seek.
      const outerFrame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          freezeAnimationsAtFrame(captureAtMs);
          signalReady?.();
        });
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(outerFrame);
      };
    }
    if (!Number.isInteger(autoSelectTabId)) {
      signalReady?.();
      return undefined;
    }
    const selectionTimer = window.setTimeout(() => {
      const tab = GATE_DETOUR_SPREAD_SESSION.protectedTabs.find((entry) => entry.tabId === autoSelectTabId);
      const button = [...surfaceRef.current.querySelectorAll('.gate-tab-chip')]
        .find((entry) => entry.getAttribute('aria-label').endsWith(`: ${tab.title}`));
      button.focus();
      button.click();
    }, 120);
    const readyTimer = window.setTimeout(() => {
      if (Number.isFinite(transferAtMs)) {
        freezeAnimationsAtFrame(transferAtMs, { settleScene: true });
        // The cancelled production flight restores this node. At the pinned
        // mid-flight instant it is still hidden behind its travelling source.
        surfaceRef.current.querySelector('.gate-orbit-orb').style.visibility = 'hidden';
      }
      signalReady?.();
    }, Number.isFinite(transferAtMs) ? 180 : 1500);
    return () => {
      window.clearTimeout(selectionTimer);
      window.clearTimeout(readyTimer);
    };
  }, [autoSelectTabId, captureAtMs, signalReady, transferAtMs]);

  const toggleTab = React.useCallback((tabId) => {
    setSelectedTabIdsToClose((currentIds) => (
      currentIds.includes(tabId)
        ? currentIds.filter((candidateId) => candidateId !== tabId)
        : [...currentIds, tabId]
    ));
  }, []);

  return (
    <div ref={surfaceRef} style={{ width: '100%', height: '100%' }}>
    <GateDetourSpreadSurface
      language={language}
      pendingDecision={pendingDecision}
      presentation={presentation}
      selectedTabIdsToClose={selectedTabIdsToClose}
      session={{ ...GATE_DETOUR_SPREAD_SESSION, pruningTutorialCompleted: tutorialCompleted }}
      onSubmit={() => {}}
      onToggleTab={toggleTab}
    />
    </div>
  );
}

function GateDetourSpreadScene({ signalReady }) {
  return <GateDetourSpreadDemo signalReady={signalReady} />;
}

export default defineVisualSceneImplementation({
  Component: GateDetourSpreadScene,
});
