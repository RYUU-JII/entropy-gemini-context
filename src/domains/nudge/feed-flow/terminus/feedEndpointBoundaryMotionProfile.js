export const FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_VERSION =
  'feed-endpoint-boundary-motion-v1';

const MIN_ELASTIC_DISPLACEMENT_PX = 28;
const MAX_ELASTIC_DISPLACEMENT_PX = 48;
const ELASTIC_DISPLACEMENT_VIEWPORT_RATIO = 0.045;
const ELASTIC_INPUT_COUPLING_RATIO = 0.18;
const ELASTIC_INPUT_HOLD_MS = 72;
const ELASTIC_SPRING_STIFFNESS = 190;
const ELASTIC_SPRING_DAMPING = 24;
// A readable, bounded footer below the last item; independent of elasticity.
const MIN_REVEAL_PX = 176;
const MAX_REVEAL_PX = 224;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function resolveMaximumDisplacementPx(viewportHeight, reducedMotion) {
  if (reducedMotion) return 0;
  return clamp(
    Math.round(
      Math.max(1, Number(viewportHeight) || 0)
      * ELASTIC_DISPLACEMENT_VIEWPORT_RATIO,
    ),
    MIN_ELASTIC_DISPLACEMENT_PX,
    MAX_ELASTIC_DISPLACEMENT_PX,
  );
}

function createProfile({
  capability,
  surfaceMode,
  restEdge,
  endpointEdge,
  elasticMode,
  viewportHeight,
  reducedMotion,
}) {
  const maximumDisplacementPx = resolveMaximumDisplacementPx(
    viewportHeight,
    reducedMotion,
  );
  const elastic = maximumDisplacementPx > 0;
  return Object.freeze({
    version: FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_VERSION,
    capability,
    surfaceMode,
    restEdge,
    endpointEdge,
    revealPx: Math.min(viewportHeight * 0.4, clamp(
      Math.round(viewportHeight * 0.26), MIN_REVEAL_PX, MAX_REVEAL_PX,
    )),
    mode: elastic ? elasticMode : 'exact_boundary',
    maximumDisplacementPx,
    inputCouplingRatio: elastic ? ELASTIC_INPUT_COUPLING_RATIO : 0,
    inputHoldMs: elastic ? ELASTIC_INPUT_HOLD_MS : 0,
    springStiffness: elastic ? ELASTIC_SPRING_STIFFNESS : 0,
    springDamping: elastic ? ELASTIC_SPRING_DAMPING : 0,
  });
}

export function resolveFeedEndpointBoundaryMotionProfile({
  capability,
  surfaceMode,
  viewportHeight,
  reducedMotion = false,
} = {}) {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    throw new Error('FEED_ENDPOINT_VIEWPORT_HEIGHT_REQUIRED');
  }
  if (capability === 'anchored_continuous' && surfaceMode === 'continuous') {
    return createProfile({
      capability,
      surfaceMode,
      restEdge: 'viewport_end',
      endpointEdge: 'tail_start',
      elasticMode: 'elastic_tail',
      viewportHeight,
      reducedMotion,
    });
  }
  if (capability === 'paged_hold' && surfaceMode === 'paged') {
    return createProfile({
      capability,
      surfaceMode,
      restEdge: 'viewport_end',
      endpointEdge: 'tail_start',
      elasticMode: 'terminal_snap',
      viewportHeight,
      reducedMotion,
    });
  }
  throw new Error(
    `FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_UNSUPPORTED:${String(capability)}:${String(surfaceMode)}`,
  );
}

export function validateFeedEndpointBoundaryMotionProfile(profile) {
  if (
    !profile
    || profile.version !== FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_VERSION
    || !['anchored_continuous', 'paged_hold'].includes(profile.capability)
    || !['continuous', 'paged'].includes(profile.surfaceMode)
    || profile.restEdge !== 'viewport_end'
    || profile.endpointEdge !== 'tail_start'
    || !['elastic_tail', 'terminal_snap', 'exact_boundary'].includes(profile.mode)
  ) {
    throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_INVALID');
  }
  const numericKeys = [
    'revealPx',
    'maximumDisplacementPx',
    'inputCouplingRatio',
    'inputHoldMs',
    'springStiffness',
    'springDamping',
  ];
  if (numericKeys.some((key) => !Number.isFinite(profile[key]) || profile[key] < 0)) {
    throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_INVALID');
  }
  if (profile.revealPx <= 0 || profile.revealPx > MAX_REVEAL_PX) {
    throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_INVALID');
  }
  if (
    profile.mode !== 'exact_boundary'
    && (
      profile.maximumDisplacementPx <= 0
      || profile.inputCouplingRatio <= 0
      || profile.inputCouplingRatio >= 1
      || profile.inputHoldMs <= 0
      || profile.springStiffness <= 0
      || profile.springDamping <= 0
    )
  ) {
    throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_INVALID');
  }
  if (
    profile.mode === 'exact_boundary'
    && (
      profile.maximumDisplacementPx !== 0
      || profile.inputCouplingRatio !== 0
      || profile.inputHoldMs !== 0
      || profile.springStiffness !== 0
      || profile.springDamping !== 0
    )
  ) {
    throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_INVALID');
  }
  const continuousProfile = (
    profile.capability === 'anchored_continuous'
    && profile.surfaceMode === 'continuous'
    && profile.restEdge === 'viewport_end'
    && profile.endpointEdge === 'tail_start'
    && ['elastic_tail', 'exact_boundary'].includes(profile.mode)
  );
  const pagedProfile = (
    profile.capability === 'paged_hold'
    && profile.surfaceMode === 'paged'
    && profile.restEdge === 'viewport_end'
    && profile.endpointEdge === 'tail_start'
    && ['terminal_snap', 'exact_boundary'].includes(profile.mode)
  );
  if (!continuousProfile && !pagedProfile) {
    throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_PROFILE_INVALID');
  }
  return profile;
}
