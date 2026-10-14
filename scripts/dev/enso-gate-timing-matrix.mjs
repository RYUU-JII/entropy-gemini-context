import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG,
  resolveSurfaceSensingThresholds,
} from './enso-model-research/legacy-feed/ensoFeedHorizonRuntimeConfig.js';
import FeedFlowJudge from '../../src/domains/nudge/feed-flow/judge/FeedFlowJudge.js';
import FeedBurstMachine from '../../src/domains/nudge/feed-flow/session/FeedBurstMachine.js';
import FeedBingeObservationWindow from '../../src/domains/nudge/attention/FeedBingeObservationWindow.js';
import { projectFeedFlowBingeEvidence } from '../../src/domains/nudge/attention/feedFlowBingeEvidence.js';
import { resolveDopamineBingeDetection } from '../../src/domains/nudge/attention/dopamineBingeDetector.js';

// Replays the retired dose/tempo policy; this is not current Enso timing.
// It drives the preserved burst machine and Judge and projects detector evidence
// at the first opportunity, but deliberately does not simulate admission,
// surface grace, endpoint travel, the actual dry
// Horizon, or renewed demand for the Gesture Gate. The numbers therefore must
// never be reported as user-visible presentation times.
//
// Consumption rates are stated per item and converted to advances, because that
// is how a person experiences a feed. On X one screenful is roughly 2.7 posts;
// on Instagram a post is about a screenful; paged surfaces advance one item at a
// time. Those ratios are estimates and the reason these timings are a design
// target rather than a measured truth — see the on-device ledger step.
const START_AT = 1_700_000_000_000;
const DEFAULT_STEP_LIMIT = 600;

// What a plain "you have been here N minutes" trigger would do to the same
// stream, so the comparison stays in front of anyone tuning these numbers.
export const PLAIN_TIME_TRIGGER_MS = 180_000;

export const GATE_TIMING_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'x_deliberate_reading',
    label: 'X · reading at 2.5s per post',
    semanticSurfaceId: 'x:home',
    surfaceMode: 'continuous',
    secondsPerItem: 2.5,
    itemsPerAdvance: 3,
    expectInterrupt: true,
  }),
  Object.freeze({
    id: 'x_ordinary_skim',
    label: 'X · skimming at 1.2s per post',
    semanticSurfaceId: 'x:home',
    surfaceMode: 'continuous',
    secondsPerItem: 1.2,
    itemsPerAdvance: 3,
    expectInterrupt: true,
  }),
  Object.freeze({
    id: 'x_rapid_flicking',
    label: 'X · flicking at 0.35s per post',
    semanticSurfaceId: 'x:home',
    surfaceMode: 'continuous',
    secondsPerItem: 0.35,
    itemsPerAdvance: 3,
    expectInterrupt: true,
  }),
  Object.freeze({
    id: 'x_stop_start_reading',
    label: 'X · skimming broken by 8s reading stops',
    semanticSurfaceId: 'x:home',
    surfaceMode: 'continuous',
    secondsPerItem: 1.2,
    itemsPerAdvance: 3,
    pauseEveryAdvances: 2,
    pauseMs: 8_000,
    expectInterrupt: true,
  }),
  Object.freeze({
    id: 'instagram_habitual_check',
    label: 'Instagram · checking at 2s per post',
    semanticSurfaceId: 'instagram:home',
    surfaceMode: 'continuous',
    secondsPerItem: 2,
    itemsPerAdvance: 1,
    expectInterrupt: true,
  }),
  Object.freeze({
    id: 'instagram_rapid_scroll',
    label: 'Instagram · scrolling at 0.6s per post',
    semanticSurfaceId: 'instagram:home',
    surfaceMode: 'continuous',
    secondsPerItem: 0.6,
    itemsPerAdvance: 1,
    expectInterrupt: true,
  }),
  Object.freeze({
    id: 'shortform_watched_through',
    label: 'Short-form · watching each video for 15s',
    semanticSurfaceId: 'tiktok:feed',
    surfaceMode: 'paged',
    secondsPerItem: 15,
    itemsPerAdvance: 1,
    stepLimit: 1_200,
    expectInterrupt: true,
  }),
  Object.freeze({
    id: 'shortform_skipping',
    label: 'Short-form · skipping after 3s',
    semanticSurfaceId: 'tiktok:feed',
    surfaceMode: 'paged',
    secondsPerItem: 3,
    itemsPerAdvance: 1,
    expectInterrupt: true,
  }),
  Object.freeze({
    id: 'x_reading_with_clickthrough',
    label: 'X · skimming while opening posts',
    semanticSurfaceId: 'x:home',
    surfaceMode: 'continuous',
    secondsPerItem: 1.2,
    itemsPerAdvance: 3,
    loopPatch: Object.freeze({
      intentionality: Object.freeze({ recentInteractiveActionCount: 2 }),
    }),
    expectInterrupt: false,
  }),
  Object.freeze({
    id: 'x_searching_backwards',
    label: 'X · scrolling back to find something',
    semanticSurfaceId: 'x:home',
    surfaceMode: 'continuous',
    secondsPerItem: 1.2,
    itemsPerAdvance: 3,
    loopPatch: Object.freeze({
      directionality: Object.freeze({ backtrackRatio: 0.25, backwardIntentCount: 2 }),
    }),
    expectInterrupt: false,
  }),
]);

function buildAdvance(definition, ts) {
  const isPaged = definition.surfaceMode === 'paged';
  const loopPatch = definition.loopPatch ?? {};
  return {
    ts,
    direction: 'forward',
    surfaceMode: definition.surfaceMode,
    screenfulDelta: isPaged ? 0 : 1,
    itemTransitionCount: isPaged ? definition.itemsPerAdvance : 0,
    freshItemsSeen: definition.itemsPerAdvance,
    confidence: 0.92,
    loopSignals: {
      context: {
        surfaceMode: definition.surfaceMode,
        semanticSurfaceId: definition.semanticSurfaceId,
        surfaceProfileId: definition.semanticSurfaceId.split(':')[0],
        surfaceConfidence: 0.92,
        contentClass: 'feed',
      },
      ...loopPatch,
      ...(loopPatch.directionality ? {
        directionality: {
          ...loopPatch.directionality,
          recentBackwardIntentAt: ts,
        },
      } : {}),
    },
  };
}

// Deterministic jitter. The scenarios are metronomes -- every interval identical
// to the millisecond -- which no hand produces. That matters for the seam stage:
// a perfectly uniform stream can never show a gap above its own median, so it can
// only ever be released by the relax point or the hard limit. Running the matrix
// with and without jitter separates "what the design does" from "what a metronome
// forces it to do".
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runEnsoGateTimingScenario(definition, {
  runtimeConfig = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG,
  jitterRatio = 0,
  jitterSeed = 0x5eed,
} = {}) {
  const random = mulberry32(jitterSeed);
  const judge = new FeedFlowJudge({ runtimeConfig });
  const machine = new FeedBurstMachine({ idleResetMs: runtimeConfig.sensing.idleResetMs });
  const evidenceWindow = new FeedBingeObservationWindow();
  const stepMs = Math.round(definition.secondsPerItem * definition.itemsPerAdvance * 1000);
  const stepLimit = definition.stepLimit ?? DEFAULT_STEP_LIMIT;
  const thresholds = resolveSurfaceSensingThresholds({
    runtimeConfig,
    semanticSurfaceId: definition.semanticSurfaceId,
    surfaceMode: definition.surfaceMode === 'paged' ? 'paged' : 'continuous',
    level: runtimeConfig.level,
  });

  let ts = START_AT;
  let itemsConsumed = 0;
  let pressure = null;
  let interrupt = null;
  let armed = null;
  let seamDecision = null;
  let evidenceAtOpportunity = null;

  for (let step = 1; step <= stepLimit && interrupt === null; step += 1) {
    if (
      definition.pauseEveryAdvances
      && step > 1
      && (step - 1) % definition.pauseEveryAdvances === 0
    ) {
      ts += definition.pauseMs ?? 0;
    }
    // Lognormal-ish: symmetric multiplicative spread around the nominal step, so
    // a fast cadence jitters by a proportionally similar amount to a slow one.
    ts += jitterRatio > 0
      ? Math.max(1, Math.round(stepMs * (1 + (jitterRatio * ((random() * 2) - 1)))))
      : stepMs;
    itemsConsumed += definition.itemsPerAdvance;

    const advance = buildAdvance(definition, ts);
    const snapshot = machine.recordAdvance(advance);
    const feedEvidence = projectFeedFlowBingeEvidence(evidenceWindow.recordAdvance(advance), { now: ts });
    const decision = judge.evaluate(snapshot, { now: ts });
    if (armed === null && decision.seam && decision.seam.decision !== 'not_armed') {
      armed = { atMs: ts - START_AT };
    }
    if (decision.state === 'interrupt') seamDecision = decision.seam?.decision ?? null;
    const reached = {
      atMs: ts - START_AT,
      itemsConsumed,
      dose: Number(snapshot.loopSignals.progression.dose.toFixed(2)),
    };
    if (decision.state === 'pressure' && pressure === null) pressure = reached;
    if (decision.state === 'interrupt') {
      interrupt = reached;
      const detection = resolveDopamineBingeDetection({ feedEvidence, now: ts });
      evidenceAtOpportunity = { candidate: detection.candidate, pressure: detection.pressure,
        threshold: detection.threshold, confidence: detection.confidence,
        reasons: detection.reasons };
    }
  }

  return Object.freeze({
    id: definition.id,
    label: definition.label,
    semanticSurfaceId: definition.semanticSurfaceId,
    surfaceMode: definition.surfaceMode,
    doseTarget: thresholds.doseTarget,
    floorMs: thresholds.floorMs,
    ceilingMs: thresholds.ceilingMs,
    pressure,
    armed,
    interrupt,
    // Actual independent detector projection at the opportunity, still not a
    // reservation, endpoint, Horizon or Gesture Gate presentation prediction.
    evidenceAtOpportunity,
    seamWaitMs: armed && interrupt ? interrupt.atMs - armed.atMs : null,
    seamDecision,
    // Which term actually decided the moment. `floor` means dose was already past
    // target and the gate was waiting on the clock; `dose` means the clock was
    // already past the floor; `ceiling` means the time guarantee fired while dose
    // was still short. Test the ceiling first -- it is the only term that can fire
    // below target, so folding it into `dose` would hide the case it exists for.
    // This is the column worth watching when tuning: when everything says `floor`,
    // the gate is a per-surface timer.
    boundBy: interrupt === null
      ? null
      : interrupt.dose < thresholds.doseTarget
        ? 'ceiling'
        : interrupt.atMs <= thresholds.floorMs + Math.round(stepMs * 1.5)
          ? 'floor'
          : 'dose',
    plainTimerItemsConsumed: Math.round(
      (definition.itemsPerAdvance / (stepMs / 1000)) * (PLAIN_TIME_TRIGGER_MS / 1000),
    ),
    expectInterrupt: definition.expectInterrupt === true,
  });
}

export function runEnsoGateTimingMatrix({
  runtimeConfig = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG,
  jitterRatio = 0,
  jitterSeed = 0x5eed,
} = {}) {
  return Object.freeze(GATE_TIMING_SCENARIOS.map(
    (scenario) => runEnsoGateTimingScenario(scenario, { runtimeConfig, jitterRatio, jitterSeed }),
  ));
}

function formatTableRows(results) {
  return results.map((result) => ({
    scenario: result.id,
    surface: result.semanticSurfaceId,
    target: result.doseTarget,
    pressure_s: result.pressure ? (result.pressure.atMs / 1000).toFixed(0) : '-',
    opportunity_s: result.interrupt ? (result.interrupt.atMs / 1000).toFixed(0) : 'passes',
    items: result.interrupt ? result.interrupt.itemsConsumed : '-',
    dose: result.interrupt ? result.interrupt.dose : '-',
    bound_by: result.boundBy ?? '-',
    detector_candidate: result.evidenceAtOpportunity?.candidate ?? '-',
    detector_pressure: result.evidenceAtOpportunity?.pressure ?? '-',
    timer_items: result.plainTimerItemsConsumed,
  }));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const results = runEnsoGateTimingMatrix();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    console.table(formatTableRows(results));
    process.stdout.write(
      `\ntimer_items = what a plain ${PLAIN_TIME_TRIGGER_MS / 1000}s trigger would let through first.\n`,
    );
  }
}
