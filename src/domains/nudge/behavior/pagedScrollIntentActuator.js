import {
  FEED_SEMANTIC_SURFACE_IDS,
  FEED_SURFACE_MODES,
  resolveFeedSurfaceRoute,
} from '../feed-flow/registry/feedSurfaceProfiles.js';

export const PAGED_SCROLL_INTENT_POLICY = Object.freeze({
  id: 'paged-scroll-intent-v1',
  stage: 'intent_gated_snap',
  holdMs: 140,
  commitLockMs: 360,
  minimumIntentPx: 48,
  maximumAccumulatedIntentPx: 960,
});

export function resolvePagedScrollIntentSurface({ hostname = '', pathname = '' } = {}) {
  const route = resolveFeedSurfaceRoute({ hostname, pathname });
  if (
    route.surfaceMode !== FEED_SURFACE_MODES.PAGED
    || route.semanticSurfaceId !== FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_SHORTS
  ) {
    return null;
  }
  return Object.freeze({
    semanticSurfaceId: route.semanticSurfaceId,
    routeFamily: route.routeFamily,
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function resolvePagedScrollSnapDelta({
  currentPosition,
  viewportSpan,
  scrollExtent,
  direction,
} = {}) {
  const current = Number(currentPosition);
  const span = Number(viewportSpan);
  const extent = Number(scrollExtent);
  const normalizedDirection = Math.sign(Number(direction));
  if (
    !Number.isFinite(current)
    || !Number.isFinite(span)
    || span <= 0
    || !Number.isFinite(extent)
    || extent < span
    || normalizedDirection === 0
  ) {
    throw new Error('PAGED_SCROLL_SNAP_METRICS_INVALID');
  }

  const maximum = Math.max(0, extent - span);
  const pageIndex = Math.round(current / span) + normalizedDirection;
  const destination = clamp(pageIndex * span, 0, maximum);
  return destination - current;
}

export function createPagedScrollIntentActuator({
  policy = PAGED_SCROLL_INTENT_POLICY,
  schedule = setTimeout,
  cancel = clearTimeout,
} = {}) {
  if (
    typeof schedule !== 'function'
    || typeof cancel !== 'function'
    || !policy
    || !Number.isFinite(policy.holdMs)
    || policy.holdMs < 0
    || !Number.isFinite(policy.commitLockMs)
    || policy.commitLockMs < 0
    || !Number.isFinite(policy.minimumIntentPx)
    || policy.minimumIntentPx <= 0
    || !Number.isFinite(policy.maximumAccumulatedIntentPx)
    || policy.maximumAccumulatedIntentPx < policy.minimumIntentPx
  ) {
    throw new Error('PAGED_SCROLL_INTENT_POLICY_INVALID');
  }

  const sessions = new Map();

  function deleteSession(target, session) {
    if (sessions.get(target) !== session) return;
    if (session.holdTimer !== null) cancel(session.holdTimer);
    if (session.lockTimer !== null) cancel(session.lockTimer);
    sessions.delete(target);
  }

  function releaseLock(target, session) {
    if (sessions.get(target) !== session) return;
    session.lockTimer = null;
    sessions.delete(target);
  }

  function commit(target, session) {
    if (sessions.get(target) !== session) return;
    session.holdTimer = null;
    try {
      if (!session.isCurrent()) {
        deleteSession(target, session);
        return;
      }
      if (Math.abs(session.accumulatedIntentPx) < policy.minimumIntentPx) {
        deleteSession(target, session);
        session.onSettled?.({ committed: false, reason: 'below_threshold' });
        return;
      }

      const metrics = session.readMetrics(target);
      const deltaY = resolvePagedScrollSnapDelta({
        currentPosition: metrics.currentPosition,
        viewportSpan: metrics.viewportSpan,
        scrollExtent: metrics.scrollExtent,
        direction: session.direction,
      });
      let appliedDeltaY = 0;
      if (Math.abs(deltaY) > 0.5) {
        appliedDeltaY = Number(session.applyDelta(target, deltaY)) || 0;
      }
      session.accumulatedIntentPx = 0;
      session.locked = true;
      session.onSettled?.({
        committed: Math.abs(deltaY) > 0.5,
        reason: Math.abs(deltaY) > 0.5 ? 'snap_committed' : 'boundary',
        requestedDeltaY: deltaY,
        appliedDeltaY,
      });
      session.lockTimer = schedule(
        () => releaseLock(target, session),
        policy.commitLockMs,
      );
    } catch (error) {
      deleteSession(target, session);
      session.onError(error);
    }
  }

  function handleInput({
    target,
    deltaY,
    readMetrics,
    applyDelta,
    isCurrent,
    onError,
    onSettled = null,
  } = {}) {
    const direction = Math.sign(Number(deltaY));
    if (
      !target
      || direction === 0
      || typeof readMetrics !== 'function'
      || typeof applyDelta !== 'function'
      || typeof isCurrent !== 'function'
      || typeof onError !== 'function'
      || (onSettled !== null && typeof onSettled !== 'function')
    ) {
      throw new Error('PAGED_SCROLL_INTENT_INPUT_INVALID');
    }

    let session = sessions.get(target) || null;
    if (session?.locked) {
      return Object.freeze({
        accepted: true,
        committed: false,
        locked: true,
        pendingPx: 0,
      });
    }
    if (session && session.direction !== direction) {
      deleteSession(target, session);
      session = null;
    }
    if (!session) {
      session = {
        accumulatedIntentPx: 0,
        applyDelta,
        direction,
        holdTimer: null,
        isCurrent,
        lockTimer: null,
        locked: false,
        onError,
        onSettled,
        readMetrics,
      };
      sessions.set(target, session);
      session.holdTimer = schedule(() => commit(target, session), policy.holdMs);
    } else {
      session.applyDelta = applyDelta;
      session.isCurrent = isCurrent;
      session.onError = onError;
      session.onSettled = onSettled;
      session.readMetrics = readMetrics;
    }
    session.accumulatedIntentPx = clamp(
      session.accumulatedIntentPx + Number(deltaY),
      -policy.maximumAccumulatedIntentPx,
      policy.maximumAccumulatedIntentPx,
    );

    return Object.freeze({
      accepted: true,
      committed: false,
      locked: false,
      pendingPx: Math.abs(session.accumulatedIntentPx),
    });
  }

  function clear() {
    for (const [target, session] of sessions) deleteSession(target, session);
  }

  function getSnapshot() {
    let pendingPx = 0;
    let locked = false;
    for (const session of sessions.values()) {
      pendingPx = Math.max(pendingPx, Math.abs(session.accumulatedIntentPx));
      locked = locked || session.locked;
    }
    return Object.freeze({
      activeSessionCount: sessions.size,
      locked,
      pendingPx,
    });
  }

  return Object.freeze({ clear, getSnapshot, handleInput });
}
