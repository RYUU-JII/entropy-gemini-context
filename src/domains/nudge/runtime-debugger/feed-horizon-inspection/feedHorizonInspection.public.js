function createInactiveSnapshot() {
  return {
    version: 2,
    active: false,
    cycleId: 0,
    source: null,
    startedAt: 0,
    command: null,
    stillGateMs: null,
    handoffMode: 'production',
    phase: 'inactive',
    endpointReady: false,
    boundaryReached: false,
    boundaryReachedAt: 0,
    holdRemainingMs: 0,
    controlsLive: false,
    feedbackPresentedAt: 0,
    finishedReason: null,
  };
}

const feedHorizonInspection = Object.freeze({
  connectOwner() {
    return this;
  },
  isActive() {
    return false;
  },
  resolvePendingEndpointDecision(canonicalDecision) {
    return canonicalDecision;
  },
  resolveSurfaceEntryGrace({ canonicalDecision } = {}) {
    if (typeof canonicalDecision !== 'function') {
      throw new Error('FEED_HORIZON_CANONICAL_GRACE_REQUIRED');
    }
    return canonicalDecision();
  },
  getStillGateMs() {
    return null;
  },
  handleContinueIntent() {
    return Object.freeze({ handled: false, accepted: false });
  },
  observeEpisodeSnapshot() {
    return createInactiveSnapshot();
  },
  finish() {
    return true;
  },
  getSnapshot() {
    return createInactiveSnapshot();
  },
});

export { feedHorizonInspection };
export default feedHorizonInspection;
