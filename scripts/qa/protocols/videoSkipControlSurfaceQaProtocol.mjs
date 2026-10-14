import { randomUUID } from 'node:crypto';

import {
  VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS,
  VIDEO_SKIP_CONTROL_SURFACE_QA_CHANNEL,
} from '../../../src/domains/nudge/video-skip/automation/videoSkipControlSurfaceQaContract.dev.js';
import {
  getVideoSkipControlSurfaceProfile,
} from '../../../src/domains/nudge/video-skip/videoSkipControlSurfaceCatalog.js';
import {
  resolveSiteId,
} from '../../../src/domains/nudge/targeting/siteIdentityCatalog.js';
import {
  ExtensionChromiumHarness,
  evaluate,
  sleep,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  defineEntropyQaAttachedArtifactStage,
  ENTROPY_QA_TRUSTED_PAGE_PATH,
} from '../../e2e/qaProfileArtifactSlot.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';
import {
  openEntropyAttachOnlyActivePage,
  proveEntropyAttachedArtifactRuntimeReadiness,
  readEntropyPostRefreshTrackingRuntimeReadiness,
} from './attachOnlyActivePageAdapter.mjs';
import {
  QaAttachedBrowserOsFocusGuard,
} from '../resources/QaAttachedBrowserOsFocusGuard.mjs';

const LOCK_ATTRIBUTE = 'data-friction-video-skip-timeline-lock';
const TIMELINE_TARGET_ATTRIBUTE = 'data-friction-video-skip-timeline-target';
const STYLE_ID = 'friction-video-skip-control-surface-lock';
const OPPORTUNITY_POLL_MS = 250;
const INPUT_SETTLE_FLOOR_MS = 500;

function requireTargetUrl(value, expectedSiteId) {
  let url;
  try {
    url = new URL(value);
  } catch (_error) {
    throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_URL_INVALID');
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:')
    || resolveSiteId(url.hostname) !== expectedSiteId
  ) {
    throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_URL_SITE_MISMATCH');
  }
  return url;
}

function createRequest(action, targetTabId, sessionId, payload = {}) {
  return {
    channel: VIDEO_SKIP_CONTROL_SURFACE_QA_CHANNEL,
    action,
    requestId: `video-skip-qa:${randomUUID()}`,
    targetTabId,
    payload: { sessionId, ...payload },
  };
}

async function sendTrustedRuntimeMessage(harness, request) {
  const delivery = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
    chrome.runtime.sendMessage(${JSON.stringify(request)}, (response) => {
      resolve({
        error: chrome.runtime.lastError?.message || null,
        response: response || null,
      });
    });
  })`);
  if (delivery?.error) {
    throw new Error(`QA_VIDEO_SKIP_CONTROL_SURFACE_MESSAGE_FAILED:${delivery.error}`);
  }
  const response = delivery?.response;
  if (
    response?.success !== true
    || response.channel !== request.channel
    || response.action !== request.action
    || response.requestId !== request.requestId
    || response.targetTabId !== request.targetTabId
  ) {
    throw new Error(
      `QA_VIDEO_SKIP_CONTROL_SURFACE_ACTION_FAILED:${request.action}:${response?.error || 'response_invalid'}`,
    );
  }
  return response.result;
}

function buildPageInspectionExpression(profile, { pauseVideos = false } = {}) {
  return `(() => {
    const profile = ${JSON.stringify(profile)};
    const pauseVideos = ${pauseVideos === true ? 'true' : 'false'};
    const independentTimelineCandidateSelector = ':is('
      + '[role="slider"], '
      + 'input[type="range"], '
      + '[aria-valuenow], '
      + '[data-testid*="progress" i], '
      + '[data-testid*="seek" i], '
      + '[data-testid*="scrub" i], '
      + '[data-e2e*="progress" i], '
      + '[data-e2e*="seek" i], '
      + '[data-e2e*="scrub" i], '
      + '[class*="progress" i], '
      + '[class*="seek" i], '
      + '[class*="scrub" i]'
      + ')';
    const roots = [];
    const visitRoot = (root) => {
      roots.push(root);
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot?.mode === 'open') visitRoot(element.shadowRoot);
      }
    };
    visitRoot(document);
    const visibleRect = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const visible = rect.width > 2
        && rect.height > 2
        && rect.bottom > 0
        && rect.right > 0
        && rect.top < innerHeight
        && rect.left < innerWidth
        && style.display !== 'none'
        && style.visibility !== 'hidden';
      return { rect, style, visible };
    };
    const entries = (selector) => roots.flatMap((root) => {
      try {
        return Array.from(root.querySelectorAll(selector)).map((element) => ({ element, root }));
      } catch (error) {
        return [{ selectorError: String(error?.message || error), root }];
      }
    });
    let videoEntries = [];
    const findInstagramStructuralPlayerRoot = (video) => {
      const declared = video?.closest?.(profile.playerRootSelector) || null;
      if (declared) return declared;
      const videoRect = video?.getBoundingClientRect?.() || null;
      const videoWidth = Number(videoRect?.width) || 0;
      const videoHeight = Number(videoRect?.height) || 0;
      let ancestor = video?.parentElement || null;
      let mediaEnvelope = ancestor;
      let depth = 0;
      while (ancestor && depth < 12) {
        const rect = ancestor.getBoundingClientRect?.() || null;
        const width = Number(rect?.width) || 0;
        const height = Number(rect?.height) || 0;
        const followsMediaGeometry = videoWidth > 0
          && videoHeight > 0
          && width >= videoWidth * 0.85
          && height >= videoHeight * 0.85
          && width <= videoWidth * 1.35
          && height <= videoHeight * 1.35;
        if (followsMediaGeometry) {
          mediaEnvelope = ancestor;
        } else if (mediaEnvelope && width > 0 && height > 0) {
          break;
        }
        ancestor = ancestor.parentElement;
        depth += 1;
      }
      return mediaEnvelope || null;
    };
    const resolvePlayerRootForVideo = (video) => (
      profile.siteId === 'instagram'
        ? findInstagramStructuralPlayerRoot(video)
        : video?.closest?.(profile.playerRootSelector) || null
    );
    const resolvePlayerRootForTimeline = (element, root) => {
      const localPlayer = element?.closest?.(profile.playerRootSelector) || null;
      if (localPlayer) return localPlayer;
      const shadowHostPlayer = root?.host?.matches?.(profile.playerRootSelector)
        ? root.host
        : null;
      if (shadowHostPlayer) return shadowHostPlayer;
      if (profile.siteId !== 'instagram') return null;
      for (const entry of videoEntries) {
        const playerRoot = resolvePlayerRootForVideo(entry.element);
        if (playerRoot?.contains?.(element)) return playerRoot;
      }
      return null;
    };
    const summarizeElement = (element) => {
      if (!element) return null;
      const geometry = visibleRect(element);
      const className = typeof element.className === 'string'
        ? element.className
        : element.getAttribute?.('class') || '';
      return {
        tagName: String(element.tagName || '').toLowerCase(),
        id: element.id || null,
        className: className ? className.slice(0, 320) : null,
        role: element.getAttribute?.('role') || null,
        ariaLabel: element.getAttribute?.('aria-label') || null,
        ariaValueMin: element.getAttribute?.('aria-valuemin') || null,
        ariaValueMax: element.getAttribute?.('aria-valuemax') || null,
        ariaValueNow: element.getAttribute?.('aria-valuenow') || null,
        dataTestId: element.getAttribute?.('data-testid') || null,
        dataE2e: element.getAttribute?.('data-e2e') || null,
        part: element.getAttribute?.('part') || null,
        visible: geometry.visible,
        rect: {
          left: geometry.rect.left,
          top: geometry.rect.top,
          width: geometry.rect.width,
          height: geometry.rect.height,
        },
        profilePlayerRootMatched: !!resolvePlayerRootForTimeline(
          element,
          element.getRootNode?.() || null,
        ),
      };
    };
    const isIndependentTimelineCandidate = (element) => {
      if (profile.siteId !== 'instagram') return true;
      const explicitSignal = ['data-testid', 'data-e2e', 'part']
        .some((name) => /progress|seek|scrub/i.test(element.getAttribute?.(name) || ''));
      if (explicitSignal) return true;
      const role = element.getAttribute?.('role') || '';
      const tagName = String(element.tagName || '').toUpperCase();
      const type = String(element.getAttribute?.('type') || '').toLowerCase();
      if (role !== 'slider' && !(tagName === 'INPUT' && type === 'range')) return false;
      const min = Number(element.getAttribute?.('aria-valuemin') ?? element.getAttribute?.('min') ?? 0);
      const max = Number(element.getAttribute?.('aria-valuemax') ?? element.getAttribute?.('max'));
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return false;
      const rect = element.getBoundingClientRect();
      const playerRoot = resolvePlayerRootForTimeline(
        element,
        element.getRootNode?.() || null,
      );
      const playerWidth = Number(playerRoot?.getBoundingClientRect?.().width) || 0;
      const minimumWidth = Math.max(48, playerWidth * 0.15);
      return rect.width >= minimumWidth
        && rect.height > 0
        && rect.width / rect.height >= 2.5;
    };
    videoEntries = roots.flatMap((root) => Array.from(root.querySelectorAll('video'))
      .map((element) => ({ element, root })));
    const visibleVideos = videoEntries
      .map((entry) => ({ ...entry, geometry: visibleRect(entry.element) }))
      .filter((entry) => entry.geometry.visible)
      .sort((left, right) => (
        right.geometry.rect.width * right.geometry.rect.height
        - left.geometry.rect.width * left.geometry.rect.height
      ));
    const videoEntry = visibleVideos[0] || videoEntries[0] || null;
    if (pauseVideos) {
      for (const entry of visibleVideos) {
        try { entry.element.pause(); } catch (_error) { /* observation only */ }
      }
    }
    const declaredTimelineEntries = entries(profile.timelineTargetSelector)
      .filter((entry) => entry.element)
      .map((entry) => ({ ...entry, geometry: visibleRect(entry.element) }));
    const admittedTimelineEntries = entries('[${TIMELINE_TARGET_ATTRIBUTE}="1"]')
      .filter((entry) => entry.element)
      .map((entry) => ({ ...entry, geometry: visibleRect(entry.element) }));
    const timelineEntries = admittedTimelineEntries
      .filter((entry) => entry.geometry.visible)
      .map((entry) => {
        const playerRoot = resolvePlayerRootForTimeline(entry.element, entry.root);
        return { ...entry, playerMatched: !!playerRoot };
      })
      .sort((left, right) => (
        Number(right.playerMatched) - Number(left.playerMatched)
        || right.geometry.rect.width - left.geometry.rect.width
      ));
    const timeline = timelineEntries[0] || null;
    const timelineClickEntry = [...timelineEntries]
      .sort((left, right) => (
        Number(right.playerMatched) - Number(left.playerMatched)
        || right.geometry.rect.width - left.geometry.rect.width
        || right.geometry.rect.bottom - left.geometry.rect.bottom
        || left.geometry.rect.height - right.geometry.rect.height
      ))[0] || null;
    const volumeEntries = entries(profile.excludedTargetSelector)
      .filter((entry) => entry.element)
      .map((entry) => ({ ...entry, geometry: visibleRect(entry.element) }))
      .filter((entry) => entry.geometry.visible);
    const styleCount = roots.reduce((count, root) => (
      count + (root.querySelector('#${STYLE_ID}') ? 1 : 0)
    ), 0);
    const video = videoEntry?.element || null;
    const videoAncestors = [];
    let ancestor = video?.parentElement || null;
    while (ancestor && videoAncestors.length < 10) {
      videoAncestors.push(summarizeElement(ancestor));
      if (ancestor.parentElement) {
        ancestor = ancestor.parentElement;
      } else {
        const root = ancestor.getRootNode?.() || null;
        ancestor = root?.host || null;
      }
    }
    const rawIndependentTimelineEntries = entries(independentTimelineCandidateSelector)
      .filter((entry) => entry.element)
      .filter((entry) => isIndependentTimelineCandidate(entry.element));
    const independentTimelineCandidates = rawIndependentTimelineEntries
      .map((entry) => summarizeElement(entry.element))
      .filter(Boolean)
      .sort((left, right) => (
        Number(right.visible) - Number(left.visible)
        || Number(right.profilePlayerRootMatched) - Number(left.profilePlayerRootMatched)
        || right.rect.width - left.rect.width
      ))
      .slice(0, 16);
    const independentTimelineOpportunityCount = independentTimelineCandidates
      .filter((candidate) => candidate.visible && candidate.profilePlayerRootMatched)
      .length;
    const declaredTimelineCandidates = declaredTimelineEntries
      .map((entry) => summarizeElement(entry.element))
      .filter(Boolean)
      .slice(0, 16);
    const videoGeometry = video ? visibleRect(video).rect : null;
    const localPlayerRoot = resolvePlayerRootForVideo(video);
    const localPlayerGeometry = localPlayerRoot ? visibleRect(localPlayerRoot) : null;
    const interactionSourceRect = localPlayerGeometry?.visible
      ? localPlayerGeometry.rect
      : videoGeometry;
    const interactionRect = interactionSourceRect ? {
      left: Math.max(0, interactionSourceRect.left),
      top: Math.max(0, interactionSourceRect.top),
      right: Math.min(innerWidth, interactionSourceRect.right),
      bottom: Math.min(innerHeight, interactionSourceRect.bottom),
    } : null;
    const timelineRect = timeline?.geometry.rect || null;
    const timelineClickRect = timelineClickEntry?.geometry.rect || null;
    return {
      href: location.href,
      readyState: document.readyState,
      rootCount: roots.length,
      videoCount: videoEntries.length,
      visibleVideoCount: visibleVideos.length,
      playerRootCount: profile.siteId === 'instagram'
        ? new Set(videoEntries.map((entry) => resolvePlayerRootForVideo(entry.element)).filter(Boolean)).size
        : entries(profile.playerRootSelector).filter((entry) => entry.element).length,
      declaredTimelineTotalCount: declaredTimelineEntries.length,
      admittedTimelineTotalCount: admittedTimelineEntries.length,
      timelineCount: timelineEntries.length,
      timelineWithinPlayer: timeline?.playerMatched === true,
      timelinePointerEvents: timeline?.geometry.style.pointerEvents || null,
      timelineCursor: timeline?.geometry.style.cursor || null,
      blockedFeedbackVisible: entries('.friction-drone.is-deployed').some(({ element }) => (
        element && visibleRect(element).visible && Number(getComputedStyle(element).opacity) > 0
      )),
      timelineDisplay: timeline?.geometry.style.display || null,
      timelineVisibility: timeline?.geometry.style.visibility || null,
      timelineRect: timelineRect ? {
        left: timelineRect.left,
        top: timelineRect.top,
        width: timelineRect.width,
        height: timelineRect.height,
      } : null,
      timelineClickRect: timelineClickRect ? {
        left: timelineClickRect.left,
        top: timelineClickRect.top,
        width: timelineClickRect.width,
        height: timelineClickRect.height,
      } : null,
      volumeCount: volumeEntries.length,
      volumePointerEvents: volumeEntries[0]?.geometry.style.pointerEvents || null,
      lockAttribute: document.documentElement.getAttribute('${LOCK_ATTRIBUTE}'),
      styleCount,
      videoAncestors,
      declaredTimelineCandidates,
      independentTimelineCandidateCount: independentTimelineOpportunityCount,
      independentTimelineTotalCount: rawIndependentTimelineEntries.length,
      independentTimelineCandidates,
      interactionRect: interactionRect
        && interactionRect.right > interactionRect.left
        && interactionRect.bottom > interactionRect.top
        ? {
            left: interactionRect.left,
            top: interactionRect.top,
            width: interactionRect.right - interactionRect.left,
            height: interactionRect.bottom - interactionRect.top,
          }
        : null,
      video: video ? {
        currentTime: Number.isFinite(video.currentTime) ? video.currentTime : null,
        duration: Number.isFinite(video.duration) ? video.duration : null,
        paused: video.paused,
        readyState: video.readyState,
        rect: videoGeometry ? {
          left: videoGeometry.left,
          top: videoGeometry.top,
          width: videoGeometry.width,
          height: videoGeometry.height,
        } : null,
      } : null,
    };
  })()`;
}

async function inspectPage(harness, page, profile, options = {}) {
  return evaluate(
    harness.cdp,
    page.sessionId,
    buildPageInspectionExpression(profile, options),
    { timeoutMs: 4_000 },
  );
}

async function hoverVideo(harness, page, observation) {
  const rect = observation?.interactionRect || observation?.video?.rect;
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return false;
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }, page.sessionId);
  return true;
}

async function revealFirstVideoOpportunity(harness, page) {
  return evaluate(
    harness.cdp,
    page.sessionId,
    `(() => {
      const roots = [];
      const visitRoot = (root) => {
        roots.push(root);
        for (const element of root.querySelectorAll('*')) {
          if (element.shadowRoot?.mode === 'open') visitRoot(element.shadowRoot);
        }
      };
      visitRoot(document);
      const candidates = roots.flatMap((root) => Array.from(root.querySelectorAll('video')))
        .map((video) => ({ video, rect: video.getBoundingClientRect() }))
        .filter((entry) => entry.rect.width > 2 && entry.rect.height > 2)
        .sort((left, right) => (
          right.rect.width * right.rect.height - left.rect.width * left.rect.height
        ));
      const candidate = candidates[0] || null;
      if (!candidate) return { attempted: false, reason: 'positive_area_video_absent' };
      candidate.video.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      return { attempted: true };
    })()`,
    { timeoutMs: 4_000 },
  );
}

function hasTimelinePoint(observation) {
  const rect = observation?.timelineRect;
  return !!rect && rect.width > 2 && rect.height > 2;
}

async function waitForTimelinePoint({
  harness,
  page,
  profile,
  deadlineAt,
  pauseVideos = false,
}) {
  let observation = null;
  while (Date.now() < deadlineAt) {
    observation = await inspectPage(harness, page, profile, { pauseVideos });
    if (hasTimelinePoint(observation) && observation.timelineWithinPlayer === true) {
      return observation;
    }
    await hoverVideo(harness, page, observation);
    await sleep(100);
  }
  return observation;
}

async function waitForSurfaceOpportunity({
  harness,
  page,
  profile,
  deadlineAt,
}) {
  let lastObservation = null;
  let revealAttempted = false;
  while (Date.now() < deadlineAt) {
    lastObservation = await inspectPage(harness, page, profile);
    if (lastObservation.videoCount > 0) {
      if (lastObservation.visibleVideoCount <= 0 && !revealAttempted) {
        revealAttempted = true;
        await revealFirstVideoOpportunity(harness, page);
        await sleep(300);
        lastObservation = await inspectPage(harness, page, profile);
      }
      await hoverVideo(harness, page, lastObservation);
      await sleep(100);
      lastObservation = await inspectPage(harness, page, profile);
      if (lastObservation.timelineCount > 0) return lastObservation;
    }
    await sleep(OPPORTUNITY_POLL_MS);
  }
  return lastObservation;
}

async function waitForRuntimeSnapshot({
  harness,
  targetTabId,
  sessionId,
  predicate,
  deadlineAt,
}) {
  let lastSnapshot = null;
  while (Date.now() < deadlineAt) {
    const result = await sendTrustedRuntimeMessage(
      harness,
      createRequest(
        VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.SNAPSHOT,
        targetTabId,
        sessionId,
      ),
    );
    lastSnapshot = result?.snapshot || null;
    if (predicate(lastSnapshot)) return lastSnapshot;
    await sleep(OPPORTUNITY_POLL_MS);
  }
  return lastSnapshot;
}

function chooseForwardRatio(observation, extraRatio = 0.24) {
  const duration = Number(observation?.video?.duration);
  const currentTime = Number(observation?.video?.currentTime);
  if (!(duration > 8) || !Number.isFinite(currentTime)) return 0.8;
  return Math.min(0.92, Math.max(0.2, (currentTime / duration) + extraRatio));
}

async function clickTimeline(harness, page, observation, ratio) {
  const rect = observation?.timelineClickRect || observation?.timelineRect;
  if (!rect || !(rect.width > 2) || !(rect.height > 2)) {
    throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_TIMELINE_POINT_REQUIRED');
  }
  const x = rect.left + (rect.width * ratio);
  const y = rect.top + (rect.height / 2);
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x, y,
  }, page.sessionId);
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', clickCount: 1,
  }, page.sessionId);
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
  }, page.sessionId);
  return Object.freeze({ x, y, ratio });
}

export function evaluateVideoSkipHardBlockEvidence({ before, feedback, after, runtimeSnapshot }) {
  const duration = Number(before?.video?.duration);
  const beforeTime = Number(before?.video?.currentTime);
  const afterTime = Number(after?.video?.currentTime);
  const maximumPassiveDrift = Number.isFinite(duration)
    ? Math.max(2, Math.min(4, duration * 0.02))
    : 3;
  const checks = Object.freeze({
    runtimeActive: runtimeSnapshot?.active === true,
    runtimeMode: runtimeSnapshot?.mode === 'hard_block',
    runtimeLock: runtimeSnapshot?.controlSurface?.lockState?.reason === 'hard_block',
    documentLock: after?.lockAttribute === 'hard_block',
    styleInstalled: Number(after?.styleCount) > 0,
    playerOwnedTimeline: after?.timelineWithinPlayer === true,
    timelineReceivesPointer: after?.timelinePointerEvents === 'auto',
    restrainedCursorAvailable: after?.timelineCursor?.includes('data:image/svg+xml') === true
      && after.timelineCursor.endsWith('not-allowed'),
    blockedFeedbackAppeared: before?.blockedFeedbackVisible === false
      && feedback?.blockedFeedbackVisible === true,
    seekDidNotAdvance: Number.isFinite(beforeTime)
      && Number.isFinite(afterTime)
      && (afterTime - beforeTime) <= maximumPassiveDrift,
  });
  return Object.freeze({
    passed: Object.values(checks).every(Boolean),
    checks,
    maximumPassiveDrift,
  });
}

export function evaluateVideoSkipCooldownEvidence({
  beforeAllowedAttempt,
  lockedSnapshot,
  lockedPage,
  beforeBlockedAttempt,
  afterBlockedAttempt,
  unlockedSnapshot,
  unlockedPage,
}) {
  const beforeAllowedTime = Number(beforeAllowedAttempt?.video?.currentTime);
  const afterAllowedTime = Number(lockedPage?.video?.currentTime);
  const beforeTime = Number(beforeBlockedAttempt?.video?.currentTime);
  const afterTime = Number(afterBlockedAttempt?.video?.currentTime);
  const checks = Object.freeze({
    firstSeekAdvanced: Number.isFinite(beforeAllowedTime)
      && Number.isFinite(afterAllowedTime)
      && (afterAllowedTime - beforeAllowedTime) > 1,
    cooldownStarted: Number(lockedSnapshot?.cooldownRemainingMs) > 0,
    runtimeLock: lockedSnapshot?.controlSurface?.lockState?.reason === 'cooldown',
    documentLock: lockedPage?.lockAttribute === 'cooldown',
    timelineReceivesPointer: lockedPage?.timelinePointerEvents === 'auto',
    secondSeekDidNotAdvance: Number.isFinite(beforeTime)
      && Number.isFinite(afterTime)
      && (afterTime - beforeTime) <= 3,
    runtimeUnlocked: unlockedSnapshot?.controlSurface?.lockState?.locked === false,
    documentUnlocked: unlockedPage?.lockAttribute === null,
  });
  return Object.freeze({ passed: Object.values(checks).every(Boolean), checks });
}

async function runPolicy({
  mode,
  harness,
  page,
  profile,
  targetTabId,
  sessionId,
  timeoutMs,
  settleMs,
  setSessionOwned,
}) {
  const started = await sendTrustedRuntimeMessage(
    harness,
    createRequest(
      VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.START,
      targetTabId,
      sessionId,
      { mode },
    ),
  );
  setSessionOwned(true);
  const deadlineAt = Date.now() + timeoutMs;
  const readySnapshot = await waitForRuntimeSnapshot({
    harness,
    targetTabId,
    sessionId,
    deadlineAt,
    predicate: (snapshot) => (
      snapshot?.active === true
      && snapshot.mode === mode
      && snapshot.connectedVideoCount > 0
      && snapshot.controlSurface?.profileId === profile.id
    ),
  });
  const opportunity = await waitForSurfaceOpportunity({
    harness,
    page,
    profile,
    deadlineAt,
  });
  if (!(opportunity?.videoCount > 0)) {
    return Object.freeze({
      status: QA_RUN_STATUSES.BLOCKED,
      mode,
      reason: 'video_not_observed',
      started,
      readySnapshot,
      opportunity,
    });
  }
  if (!(opportunity?.timelineCount > 0) || opportunity.timelineWithinPlayer !== true) {
    if (!(opportunity?.visibleVideoCount > 0)) {
      return Object.freeze({
        status: QA_RUN_STATUSES.BLOCKED,
        mode,
        reason: 'visible_video_timeline_opportunity_not_observed',
        started,
        readySnapshot,
        opportunity,
      });
    }
    if (!(opportunity?.independentTimelineCandidateCount > 0)) {
      return Object.freeze({
        status: QA_RUN_STATUSES.BLOCKED,
        mode,
        reason: 'independent_timeline_opportunity_not_observed',
        started,
        readySnapshot,
        opportunity,
      });
    }
    return Object.freeze({
      status: QA_RUN_STATUSES.FAIL,
      mode,
      reason: 'declared_player_timeline_not_observed',
      started,
      readySnapshot,
      opportunity,
    });
  }

  if (mode === 'hard_block') {
    const before = await waitForTimelinePoint({
      harness,
      page,
      profile,
      deadlineAt: Math.min(deadlineAt, Date.now() + 2_000),
      pauseVideos: true,
    });
    if (!hasTimelinePoint(before) || before.timelineWithinPlayer !== true) {
      return Object.freeze({
        status: QA_RUN_STATUSES.FAIL,
        mode,
        reason: 'timeline_point_not_observed_before_attempt',
        before,
      });
    }
    const click = await clickTimeline(harness, page, before, chooseForwardRatio(before));
    // Observe the transient feedback before a longer media-settle window can hide it.
    await sleep(INPUT_SETTLE_FLOOR_MS);
    const feedback = await inspectPage(harness, page, profile);
    if (settleMs > INPUT_SETTLE_FLOOR_MS) await sleep(settleMs - INPUT_SETTLE_FLOOR_MS);
    const after = await inspectPage(harness, page, profile, { pauseVideos: true });
    const runtimeResult = await sendTrustedRuntimeMessage(
      harness,
      createRequest(
        VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.SNAPSHOT,
        targetTabId,
        sessionId,
      ),
    );
    const verdict = evaluateVideoSkipHardBlockEvidence({
      before,
      feedback,
      after,
      runtimeSnapshot: runtimeResult.snapshot,
    });
    return Object.freeze({
      status: verdict.passed ? QA_RUN_STATUSES.PASS : QA_RUN_STATUSES.FAIL,
      mode,
      reason: verdict.passed ? null : 'hard_block_contract_failed',
      click,
      before,
      feedback,
      after,
      runtimeSnapshot: runtimeResult.snapshot,
      verdict,
    });
  }

  let unlockedBeforeAttempt = readySnapshot;
  if (readySnapshot?.controlSurface?.lockState?.locked === true) {
    const existingDeadline = Math.min(
      deadlineAt,
      Number(readySnapshot.controlSurface.lockState.unlockAt) + 2_000,
    );
    unlockedBeforeAttempt = await waitForRuntimeSnapshot({
      harness,
      targetTabId,
      sessionId,
      deadlineAt: existingDeadline,
      predicate: (snapshot) => snapshot?.controlSurface?.lockState?.locked === false,
    });
  }
  if (unlockedBeforeAttempt?.controlSurface?.lockState?.locked !== false) {
    return Object.freeze({
      status: QA_RUN_STATUSES.BLOCKED,
      mode,
      reason: 'existing_cooldown_did_not_expire',
      readySnapshot,
      unlockedBeforeAttempt,
    });
  }

  const beforeAllowedAttempt = await waitForTimelinePoint({
    harness,
    page,
    profile,
    deadlineAt: Math.min(deadlineAt, Date.now() + 2_000),
    pauseVideos: true,
  });
  if (!hasTimelinePoint(beforeAllowedAttempt) || beforeAllowedAttempt.timelineWithinPlayer !== true) {
    return Object.freeze({
      status: QA_RUN_STATUSES.FAIL,
      mode,
      reason: 'timeline_point_not_observed_before_allowed_attempt',
      beforeAllowedAttempt,
    });
  }
  const allowedClick = await clickTimeline(
    harness,
    page,
    beforeAllowedAttempt,
    chooseForwardRatio(beforeAllowedAttempt),
  );
  const lockedSnapshot = await waitForRuntimeSnapshot({
    harness,
    targetTabId,
    sessionId,
    deadlineAt,
    predicate: (snapshot) => (
      snapshot?.controlSurface?.lockState?.reason === 'cooldown'
      && snapshot.cooldownRemainingMs > 0
    ),
  });
  const lockedPage = await waitForTimelinePoint({
    harness,
    page,
    profile,
    deadlineAt: Math.min(deadlineAt, Date.now() + 1_500),
    pauseVideos: true,
  });
  if (lockedSnapshot?.controlSurface?.lockState?.reason !== 'cooldown') {
    return Object.freeze({
      status: QA_RUN_STATUSES.FAIL,
      mode,
      reason: 'allowed_seek_did_not_start_cooldown',
      beforeAllowedAttempt,
      allowedClick,
      lockedSnapshot,
      lockedPage,
    });
  }

  if (!hasTimelinePoint(lockedPage) || lockedPage.timelineWithinPlayer !== true) {
    return Object.freeze({
      status: QA_RUN_STATUSES.FAIL,
      mode,
      reason: 'timeline_point_not_observed_during_cooldown',
      beforeAllowedAttempt,
      allowedClick,
      lockedSnapshot,
      lockedPage,
    });
  }

  const beforeBlockedAttempt = lockedPage;
  const blockedClick = await clickTimeline(
    harness,
    page,
    beforeBlockedAttempt,
    chooseForwardRatio(beforeBlockedAttempt, 0.14),
  );
  await sleep(Math.max(INPUT_SETTLE_FLOOR_MS, settleMs));
  const afterBlockedAttempt = await inspectPage(harness, page, profile, { pauseVideos: true });
  const unlockAt = Number(lockedSnapshot.controlSurface.lockState.unlockAt);
  const unlockedSnapshot = await waitForRuntimeSnapshot({
    harness,
    targetTabId,
    sessionId,
    deadlineAt: Math.min(deadlineAt, unlockAt + 2_000),
    predicate: (snapshot) => snapshot?.controlSurface?.lockState?.locked === false,
  });
  const unlockedPage = await inspectPage(harness, page, profile, { pauseVideos: true });
  const verdict = evaluateVideoSkipCooldownEvidence({
    beforeAllowedAttempt,
    lockedSnapshot,
    lockedPage,
    beforeBlockedAttempt,
    afterBlockedAttempt,
    unlockedSnapshot,
    unlockedPage,
  });
  return Object.freeze({
    status: verdict.passed ? QA_RUN_STATUSES.PASS : QA_RUN_STATUSES.FAIL,
    mode,
    reason: verdict.passed ? null : 'cooldown_contract_failed',
    allowedClick,
    blockedClick,
    beforeAllowedAttempt,
    lockedSnapshot,
    lockedPage,
    beforeBlockedAttempt,
    afterBlockedAttempt,
    unlockedSnapshot,
    unlockedPage,
    verdict,
  });
}

export async function executeQaProtocol(context) {
  const {
    plan,
    artifact,
    browser,
    evidence,
    initialWindowFocusAnchor,
    attachedBrowserOsFocusGuard,
    attachedBrowserOsFocusBaseline,
    registerCleanup,
    reportBrowserGpuCapability,
    recoveryJournal,
  } = context;
  if (plan.mode !== 'agent') throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_MODE_INVALID');
  if (artifact?.id !== 'dev_extension' || artifact?.releaseProfile !== 'dev') {
    throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_DEV_ARTIFACT_REQUIRED');
  }
  if (browser?.processOwnership !== 'attach_only' || !browser.cdpEndpoint) {
    throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_ATTACH_ONLY_BROWSER_REQUIRED');
  }
  if (!Number.isInteger(browser.baselinePageTargetCount)) {
    throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_BASELINE_PAGE_COUNT_REQUIRED');
  }
  if (
    browser.baselinePageTargetCount === 0
    && initialWindowFocusAnchor?.status !== 'ready'
  ) {
    throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_INITIAL_WINDOW_FOCUS_ANCHOR_REQUIRED');
  }

  const siteId = plan.protocolOptions.siteId;
  const surface = plan.protocolOptions.surface;
  const profile = getVideoSkipControlSurfaceProfile(siteId);
  if (!profile) throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_PROFILE_REQUIRED');
  const targetUrl = requireTargetUrl(plan.parameters.url, siteId);
  const temporaryManifest = Object.freeze({
    requiredPermissions: ['scripting'],
    requiredHostPermissions: [`${targetUrl.origin}/*`],
  });
  const attachedArtifactStage = browser.lifecyclePolicy === 'managed'
    ? defineEntropyQaAttachedArtifactStage({
      browser,
      browserExecution: plan.browserExecution,
      sourceDir: artifact.path,
      artifactIdentity: {
        artifactId: artifact.id,
        inputDigest: artifact.inputDigest,
        buildId: artifact.buildId,
        releaseProfile: artifact.releaseProfile,
      },
      temporaryManifest,
    })
    : null;
  const harness = new ExtensionChromiumHarness({
    chromePath: browser.chrome,
    distDir: browser.extensionSlot,
    rootDir: plan.rootDir,
    headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement,
    cdpEndpoint: browser.cdpEndpoint,
    expectedBrowserIdentity: browser.browserIdentity,
    attachedArtifactStage,
    keepTemp: false,
    qaProfileDir: browser.profile,
    qaProfileDirectory: browser.profileDirectory,
    tempPrefix: `entropy-video-skip-${siteId}-${surface}-qa-`,
    loadInPlace: true,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    attachedArtifactRuntimeReadiness: browser.lifecyclePolicy === 'managed'
      ? proveEntropyAttachedArtifactRuntimeReadiness
      : null,
    recoveryJournal,
  });
  registerCleanup('video_skip_control_surface_harness', () => harness.close().then(() => ({
    browserProcessPreserved: true,
  })));

  const osFocusGuard = attachedBrowserOsFocusGuard
    || new QaAttachedBrowserOsFocusGuard({ browser });
  const osFocusProof = attachedBrowserOsFocusBaseline
    ? [attachedBrowserOsFocusBaseline]
    : [];
  const recordOsFocusProof = async (receipt) => {
    if (!receipt) return;
    osFocusProof.push(receipt);
    await evidence.event('QA_BROWSER_OS_FOCUS_PRESERVED', receipt);
  };
  if (!attachedBrowserOsFocusBaseline) {
    await recordOsFocusProof(await osFocusGuard.observeBaseline('before_harness_start'));
  }
  await harness.start();
  await recordOsFocusProof(await osFocusGuard.assertPreserved('after_harness_start'));
  await reportBrowserGpuCapability(harness.gpuCapability);
  if (browser.lifecyclePolicy === 'managed') {
    await evidence.event('QA_MANAGED_EXTENSION_SLOT_ADMITTED', {
      environmentId: browser.environmentId,
      profileSlotId: browser.profileSlotId,
      action: harness.managedExtensionSlotAction,
      installMode: harness.extensionInstallMode,
      artifactSync: harness.attachedArtifactSyncReceipt,
    });
  }
  if (harness.uninstallExtensionOnClose) {
    throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_EXTENSION_UNINSTALL_FORBIDDEN');
  }
  const postRefreshRuntimeReadiness = readEntropyPostRefreshTrackingRuntimeReadiness(harness);
  if (postRefreshRuntimeReadiness?.required === true) {
    await evidence.event('QA_TRACKING_RUNTIME_POST_REFRESH_READY', {
      protocol: 'video_skip_control_surface',
      ...postRefreshRuntimeReadiness,
    });
  }
  const attachPageAdmission = await openEntropyAttachOnlyActivePage({
    harness,
    url: targetUrl.href,
    browserExecution: plan.browserExecution,
  });
  const { page, targetTab } = attachPageAdmission;
  await recordOsFocusProof(await osFocusGuard.assertPreserved('after_target_activation'));
  const targetTabId = Number(targetTab?.id);
  if (!Number.isInteger(targetTabId) || targetTabId < 0) {
    throw new Error('QA_VIDEO_SKIP_CONTROL_SURFACE_TARGET_TAB_REQUIRED');
  }

  const sessionId = `video-skip:${randomUUID()}`;
  let sessionOwned = false;
  const stopSession = async () => {
    if (!sessionOwned) return Object.freeze({ stopped: false });
    const result = await sendTrustedRuntimeMessage(
      harness,
      createRequest(
        VIDEO_SKIP_CONTROL_SURFACE_QA_ACTIONS.STOP,
        targetTabId,
        sessionId,
      ),
    );
    sessionOwned = false;
    return result;
  };
  registerCleanup('video_skip_control_surface_session', stopSession);

  const requestedPolicies = [plan.parameters.policy];
  const policyResults = [];
  for (const mode of requestedPolicies) {
    const result = await runPolicy({
      mode,
      harness,
      page,
      profile,
      targetTabId,
      sessionId,
      timeoutMs: plan.parameters.timeoutMs,
      settleMs: plan.parameters.settleMs,
      setSessionOwned: (owned) => { sessionOwned = owned; },
    });
    const stopResult = await stopSession();
    await sleep(100);
    const teardownPage = await inspectPage(harness, page, profile);
    const teardownPassed = teardownPage.lockAttribute === null && teardownPage.styleCount === 0;
    const finalizedResult = Object.freeze({
      ...result,
      stopResult,
      teardownPage,
      teardownPassed,
      status: result.status === QA_RUN_STATUSES.PASS && !teardownPassed
        ? QA_RUN_STATUSES.FAIL
        : result.status,
      reason: result.status === QA_RUN_STATUSES.PASS && !teardownPassed
        ? 'teardown_contract_failed'
        : result.reason,
    });
    policyResults.push(finalizedResult);
    await evidence.event('QA_VIDEO_SKIP_CONTROL_SURFACE_POLICY_RESULT', {
      siteId,
      surface,
      mode,
      status: finalizedResult.status,
      reason: finalizedResult.reason,
      verdict: finalizedResult.verdict || null,
      teardownPassed,
    });
    if (finalizedResult.status !== QA_RUN_STATUSES.PASS) break;
  }

  await recordOsFocusProof(await osFocusGuard.assertPreserved('after_protocol_completion'));
  const status = policyResults.some((result) => result.status === QA_RUN_STATUSES.FAIL)
    ? QA_RUN_STATUSES.FAIL
    : policyResults.some((result) => result.status === QA_RUN_STATUSES.BLOCKED)
      ? QA_RUN_STATUSES.BLOCKED
      : QA_RUN_STATUSES.PASS;
  return Object.freeze({
    status,
    protocol: 'video_skip_control_surface',
    siteId,
    surface,
    targetTabId,
    targetOrigin: targetUrl.origin,
    policyResults: Object.freeze(policyResults),
    browserProcessPreserved: true,
    initialWindowFocusAnchor,
    osFocusProof: Object.freeze(osFocusProof),
    targetAdmission: Object.freeze({
      ...attachPageAdmission.receipt,
      postRefreshRuntimeReadiness,
    }),
  });
}
