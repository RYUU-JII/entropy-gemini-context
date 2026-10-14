import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import FeedBingeObservationWindow from '../../src/domains/nudge/attention/FeedBingeObservationWindow.js';
import { resolveDopamineBingeDetection } from '../../src/domains/nudge/attention/dopamineBingeDetector.js';
import { projectFeedFlowBingeEvidence } from '../../src/domains/nudge/attention/feedFlowBingeEvidence.js';
import { resolveFeedEndpointAdapter } from '../../src/domains/nudge/feed-flow/actuation/feedEndpointAdapterCatalog.js';
import FeedSurfaceRegistry from '../../src/domains/nudge/feed-flow/registry/feedSurfaceRegistry.js';
import { resolveFeedSurfaceRoute } from '../../src/domains/nudge/feed-flow/registry/feedSurfaceProfiles.js';

// This is a deterministic admission shadow, not a browser/DOM replay. Inputs
// represent already-confirmed feed advances. `candidate_allowlisted` therefore
// means the detector and platform allowlist agree; structure readiness, endpoint
// resolution, grace/cooldown, Horizon actuation, and presentation still retain
// their own production authority.
const START_AT = 100000;

const SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'x_rapid_feed',
    hostname: 'x.com',
    pathname: '/home',
    sampleCount: 40,
    intervalMs: 1000,
    screenfulDelta: 0.5,
    freshItemsSeen: 1,
    expectedCandidate: true,
  }),
  Object.freeze({
    id: 'x_deliberate_feed',
    hostname: 'x.com',
    pathname: '/home',
    sampleCount: 12,
    intervalMs: 20000,
    screenfulDelta: 0.5,
    freshItemsSeen: 1,
    mediaRelief: true,
    expectedCandidate: false,
  }),
  Object.freeze({
    id: 'x_status_document',
    hostname: 'x.com',
    pathname: '/zen/status/100',
    sampleCount: 40,
    intervalMs: 1000,
    screenfulDelta: 0.5,
    freshItemsSeen: 1,
    expectedCandidate: false,
    expectedObserveOnly: true,
  }),
  Object.freeze({
    id: 'instagram_rapid_home',
    hostname: 'www.instagram.com',
    pathname: '/',
    sampleCount: 40,
    intervalMs: 1000,
    screenfulDelta: 0.5,
    freshItemsSeen: 1,
    expectedCandidate: true,
  }),
  Object.freeze({
    id: 'instagram_rapid_reels',
    hostname: 'www.instagram.com',
    pathname: '/reels/example',
    sampleCount: 30,
    intervalMs: 1800,
    itemTransitionCount: 1,
    freshItemsSeen: 1,
    expectedCandidate: true,
  }),
  Object.freeze({
    id: 'instagram_deliberate_reels',
    hostname: 'www.instagram.com',
    pathname: '/reels/example',
    sampleCount: 12,
    intervalMs: 15000,
    itemTransitionCount: 1,
    freshItemsSeen: 1,
    mediaRelief: true,
    expectedCandidate: false,
  }),
  Object.freeze({
    id: 'instagram_rapid_explore',
    hostname: 'www.instagram.com',
    pathname: '/explore',
    sampleCount: 30,
    intervalMs: 1800,
    screenfulDelta: 0.5,
    itemTransitionCount: 1,
    freshItemsSeen: 1,
    expectedCandidate: true,
    expectedObserveOnly: true,
  }),
  Object.freeze({
    id: 'instagram_post_document',
    hostname: 'www.instagram.com',
    pathname: '/p/example',
    sampleCount: 40,
    intervalMs: 1000,
    screenfulDelta: 0.5,
    freshItemsSeen: 1,
    expectedCandidate: false,
    expectedObserveOnly: true,
  }),
  Object.freeze({
    id: 'tiktok_rapid_feed',
    hostname: 'www.tiktok.com',
    pathname: '/foryou',
    sampleCount: 30,
    intervalMs: 1800,
    itemTransitionCount: 1,
    freshItemsSeen: 1,
    expectedCandidate: true,
  }),
  Object.freeze({
    id: 'tiktok_deliberate_feed',
    hostname: 'www.tiktok.com',
    pathname: '/foryou',
    sampleCount: 12,
    intervalMs: 15000,
    itemTransitionCount: 1,
    freshItemsSeen: 1,
    mediaRelief: true,
    expectedCandidate: false,
  }),
  Object.freeze({
    id: 'tiktok_profile_document',
    hostname: 'www.tiktok.com',
    pathname: '/@zen',
    sampleCount: 30,
    intervalMs: 1800,
    itemTransitionCount: 1,
    freshItemsSeen: 1,
    expectedCandidate: false,
    expectedObserveOnly: true,
  }),
  Object.freeze({
    id: 'youtube_rapid_home',
    hostname: 'www.youtube.com',
    pathname: '/',
    sampleCount: 40,
    intervalMs: 1000,
    screenfulDelta: 0.5,
    freshItemsSeen: 1,
    expectedCandidate: true,
  }),
  Object.freeze({
    id: 'youtube_rapid_browse',
    hostname: 'www.youtube.com',
    pathname: '/feed/subscriptions',
    sampleCount: 40,
    intervalMs: 1000,
    screenfulDelta: 0.5,
    freshItemsSeen: 1,
    expectedCandidate: true,
    expectedObserveOnly: true,
  }),
  Object.freeze({
    id: 'youtube_watch_document',
    hostname: 'www.youtube.com',
    pathname: '/watch',
    sampleCount: 40,
    intervalMs: 1000,
    screenfulDelta: 0.5,
    freshItemsSeen: 1,
    expectedCandidate: false,
    expectedObserveOnly: true,
  }),
  Object.freeze({
    id: 'youtube_live_document',
    hostname: 'www.youtube.com',
    pathname: '/live/stream-id',
    sampleCount: 40,
    intervalMs: 1000,
    screenfulDelta: 0.5,
    freshItemsSeen: 1,
    expectedCandidate: false,
    expectedObserveOnly: true,
  }),
  Object.freeze({
    id: 'youtube_rapid_shorts',
    hostname: 'www.youtube.com',
    pathname: '/shorts/example',
    sampleCount: 30,
    intervalMs: 1800,
    itemTransitionCount: 1,
    freshItemsSeen: 1,
    expectedCandidate: true,
  }),
  Object.freeze({
    id: 'youtube_deliberate_shorts',
    hostname: 'www.youtube.com',
    pathname: '/shorts/example',
    sampleCount: 12,
    intervalMs: 15000,
    itemTransitionCount: 1,
    freshItemsSeen: 1,
    mediaRelief: true,
    expectedCandidate: false,
  }),
]);

function createLoopSignals(surface, observedAt, mediaRelief) {
  return {
    context: {
      surfaceMode: surface.surfaceMode,
      surfaceProfileId: surface.profileId,
      surfaceConfidence: surface.surfaceConfidence,
      contentClass: surface.contentClass,
    },
    media: {
      recentMediaPlayAt: mediaRelief ? Math.max(0, observedAt - 7000) : 0,
      recentMediaPauseAt: 0,
    },
  };
}

function resolveShadowOutcome({ detection, evidence, endpointAdapter }) {
  if (!evidence.eligibleSurface) return 'surface_ineligible';
  if (!detection.candidate) return 'below_candidate';
  if (endpointAdapter.capability === 'observe_only') return 'candidate_observe_only';
  return 'candidate_allowlisted';
}

export function runEnsoShadowScenario(definition, {
  surfaceRegistry = new FeedSurfaceRegistry(),
} = {}) {
  const route = resolveFeedSurfaceRoute({
    hostname: definition.hostname,
    pathname: definition.pathname,
  });
  const surface = surfaceRegistry.resolve({
    hostname: definition.hostname,
    pathname: definition.pathname,
    documentRef: null,
  });
  const endpointAdapter = resolveFeedEndpointAdapter({
    profileId: surface.profileId,
    semanticSurfaceId: surface.semanticSurfaceId,
    surfaceMode: surface.surfaceMode,
  });
  const observationWindow = new FeedBingeObservationWindow();
  let firstCandidate = null;
  let evidence = null;
  let detection = null;

  for (let index = 0; index < definition.sampleCount; index += 1) {
    const observedAt = START_AT + (index * definition.intervalMs);
    observationWindow.recordAdvance({
      ts: observedAt,
      direction: 'forward',
      surfaceMode: surface.surfaceMode,
      screenfulDelta: definition.screenfulDelta || 0,
      itemTransitionCount: definition.itemTransitionCount || 0,
      freshItemsSeen: definition.freshItemsSeen || 0,
      confidence: 0.8,
      loopSignals: createLoopSignals(surface, observedAt, definition.mediaRelief === true),
    });
    const snapshot = observationWindow.getSnapshot({ now: observedAt });
    evidence = projectFeedFlowBingeEvidence(snapshot, { now: observedAt });
    detection = resolveDopamineBingeDetection({ feedEvidence: evidence, now: observedAt });
    if (!firstCandidate && detection.candidate) {
      firstCandidate = {
        sample: index + 1,
        elapsedMs: observedAt - START_AT,
        pressure: detection.pressure,
      };
    }
  }

  if (!evidence || !detection) {
    throw new Error(`ENSO_SHADOW_SCENARIO_EMPTY:${definition.id}`);
  }

  return Object.freeze({
    id: definition.id,
    semanticSurfaceId: route.semanticSurfaceId,
    routeFamily: route.routeFamily,
    surfaceMode: surface.surfaceMode,
    samples: definition.sampleCount,
    observedDurationMs: (definition.sampleCount - 1) * definition.intervalMs,
    candidate: detection.candidate,
    firstCandidateSample: firstCandidate?.sample || null,
    firstCandidateAtMs: firstCandidate?.elapsedMs ?? null,
    behaviorLoad: evidence.behaviorLoad,
    pressure: detection.pressure,
    confidence: detection.confidence,
    endpointCapability: endpointAdapter.capability,
    shadowOutcome: resolveShadowOutcome({ detection, evidence, endpointAdapter }),
    expectedCandidate: definition.expectedCandidate,
    expectedObserveOnly: definition.expectedObserveOnly === true,
  });
}

export function runEnsoShadowScenarioMatrix() {
  const surfaceRegistry = new FeedSurfaceRegistry();
  return Object.freeze(SCENARIOS.map((scenario) => runEnsoShadowScenario(scenario, {
    surfaceRegistry,
  })));
}

function formatTableRows(results) {
  return results.map((result) => ({
    scenario: result.id,
    surface: result.semanticSurfaceId,
    mode: result.surfaceMode,
    candidate: result.candidate,
    first_ms: result.firstCandidateAtMs ?? '-',
    pressure: result.pressure.toFixed(3),
    endpoint: result.endpointCapability,
    outcome: result.shadowOutcome,
  }));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const results = runEnsoShadowScenarioMatrix();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    console.table(formatTableRows(results));
  }
}
