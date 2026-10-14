import React, { useLayoutEffect, useRef } from 'react';
import { ZEN_SENTINEL_DEPARTURE_FAULT_MS } from '../../../domains/nudge/koi/ZenSentinelDeparture.js';

import { createNudgeSwarmEngine } from '../../../domains/nudge/engine/NudgeSwarmEngine.js';
import {
  GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS,
  GLOBAL_SENTINEL_ENTRY_STAGES,
  GLOBAL_SENTINEL_RIFT_APERTURE_OPEN_MS,
  GLOBAL_SENTINEL_GAME_PHASES,
  GLOBAL_SENTINEL_TERMINAL_MA_MS,
  resolveGlobalSentinelRhythmState,
  resolveGlobalSentinelSimulationPolicy,
} from '../../../domains/nudge/nudge/nudgeGameGlobalSentinelProtocol.js';
import {
  createSentinelProtocolSessionController,
} from '../../../domains/nudge/runtime/SentinelProtocolSessionController.js';
import {
  createNudgeTerminalSequenceState,
  getNudgeTerminalSequenceTotalMs,
} from '../../../domains/nudge/nudge/nudgeGameTerminalSequence.js';
import {
  resolveNudgeProtocolScene,
} from '../../../domains/nudge/protocols/nudgeProtocolScene.js';
import { NUDGE_SCENE_PHASES } from '../../../domains/nudge/nudge/nudgeGameScene.js';
import {
  DEFAULT_NUDGE_RUNTIME_TUNING,
  normalizeNudgeRuntimeConfig,
} from '../../../domains/settings/config/nudgeConfig.js';
import {
  GLOBAL_SENTINEL_FINAL_HIT_AFTERMATH_MS,
  GLOBAL_SENTINEL_HIT_AFTERMATH_MS,
  GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES,
} from '../../../domains/nudge/nudge/nudgeVisuals.js';
import { withDeterministicMathRandom } from '../deterministicRandom.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import './globalSentinelSequenceScene.css';

// Each evidence card is a downscaled view of a representative production
// desktop, not a 448 × 252 runtime. Keep the engine and renderer in full
// viewport coordinates so fracture topology, actor travel, and closure timing
// are composed at production-relative scale before CSS presents the filmstrip.
export const GLOBAL_SENTINEL_EVIDENCE_SIMULATION_BOUNDS = Object.freeze({
  width: 1280,
  height: 720,
});

const CANVAS_WIDTH = GLOBAL_SENTINEL_EVIDENCE_SIMULATION_BOUNDS.width;
const CANVAS_HEIGHT = GLOBAL_SENTINEL_EVIDENCE_SIMULATION_BOUNDS.height;
const FIXED_TIME_MS = 1_730_000_000_000;
const ENTRY_ACTIVATION_TIME_MS = FIXED_TIME_MS + 1600;
const SIMULATION_BREAK_SEED = 0;

const GLOBAL_SENTINEL_RUNTIME_CONFIG = Object.freeze(normalizeNudgeRuntimeConfig({
  protocolScope: 'global',
  protocolVariant: 'global_sentinel',
  protocolIntensity: 0.88,
  escalationReason: 'global_budget',
  simulationBreakSeed: SIMULATION_BREAK_SEED,
  protocol: {
    rampMs: 45_000,
  },
}, {
  defaults: DEFAULT_NUDGE_RUNTIME_TUNING,
}));

const GLOBAL_SENTINEL_SCENE = Object.freeze(resolveNudgeProtocolScene({
  protocolScope: 'global',
  protocolVariant: 'global_sentinel',
  protocolIntensity: 0.88,
  escalationReason: 'global_budget',
}));

const GLOBAL_SENTINEL_ENTRY_FRAMES = Object.freeze([
  Object.freeze({
    id: 'awaiting',
    index: '00',
    title: 'Calling signal · shikigami and shadow',
    detail: 'The colored messenger and its apparently ordinary shadow share one movement over the untouched page.',
    status: 'standby',
    engineTimeMs: FIXED_TIME_MS + 1000,
  }),
  Object.freeze({
    id: 'hover',
    index: '01',
    title: 'Hover · hit-test probe',
    detail: 'The real probe admits the koi; the engine currently exposes no distinct hover mutation.',
    status: 'target',
    engineTimeMs: FIXED_TIME_MS + 1400,
  }),
  Object.freeze({
    id: 'entry-60',
    index: '02',
    title: 'Activation · +60 ms',
    detail: 'The first presented contact already retains the complete impact fracture at its reserved coordinate.',
    status: 'activation',
    offsetMs: 60,
  }),
  Object.freeze({
    id: 'entry-160',
    index: '03',
    title: 'Rupture · +160 ms',
    detail: 'The first fixed glass fracture follows the contact while the messenger remains readable.',
    status: 'activation',
    offsetMs: 160,
  }),
  Object.freeze({
    id: 'entry-320',
    index: '04',
    title: 'Arrested glass · +320 ms',
    detail: 'The original tips remain fixed while the messenger prepares to separate from its shadow.',
    status: 'activation',
    offsetMs: 320,
  }),
  Object.freeze({
    id: 'entry-400',
    index: '05',
    title: 'Connection loss · +400 ms',
    detail: 'The messenger begins to release while the shadow no longer obeys its motion.',
    status: 'activation',
    offsetMs: 400,
  }),
  Object.freeze({
    id: 'entry-520',
    index: '06',
    title: 'Release · +520 ms',
    detail: 'Color dissolves from the original actor and exposes the separately moving system sentinel.',
    status: 'entry',
    offsetMs: 520,
  }),
  Object.freeze({
    id: 'shadow-detached', title: 'Spy revealed · the shadow survives',
    detail: 'The short paired diagnostic interruption identifies a unit whose connection has broken.',
    status: 'activation', offsetMs: GLOBAL_SENTINEL_ENTRY_STAGES.DETACHMENT + 850,
  }),
  Object.freeze({
    id: 'departure-cruise', title: 'Withdrawal · a continuous swimmer',
    detail: 'The original motor carries the shadow toward its seed-selected bank through a native course change.',
    status: 'activation', offsetMs: ZEN_SENTINEL_DEPARTURE_FAULT_MS - 160,
  }),
  Object.freeze({
    id: 'departure-hold', title: 'Signal stalls · one brief held pose',
    detail: 'A single short hold interrupts a flowing body and fin rig.',
    status: 'activation', offsetMs: ZEN_SENTINEL_DEPARTURE_FAULT_MS + 30,
  }),
  Object.freeze({
    id: 'departure-rewind', title: 'Recoil · the address moves backward',
    detail: 'A local raster fault displaces the silhouette against its live heading.',
    status: 'activation', offsetMs: ZEN_SENTINEL_DEPARTURE_FAULT_MS + 110,
  }),
  Object.freeze({
    id: 'departure-split', title: 'Double exposure · one unit resolves',
    detail: 'The displaced silhouette briefly separates before continuous departure resumes.',
    status: 'activation', offsetMs: ZEN_SENTINEL_DEPARTURE_FAULT_MS + 205,
  }),
  Object.freeze({
    id: 'shadow-departure', title: 'Withdrawal · independent movement',
    detail: 'The surviving shadow withdraws while independent panel failures interrupt the live page.',
    status: 'activation', offsetMs: GLOBAL_SENTINEL_ENTRY_STAGES.SHADOW_DEPARTURE + 820,
  }),
  Object.freeze({
    id: 'panel-cascade', title: 'Panel collapse · the page survives in strips',
    detail: 'The same first fracture divides working page regions from failing LCD columns.',
    status: 'critical', offsetMs: GLOBAL_SENTINEL_ENTRY_STAGES.ELECTRICAL_CASCADE + 470,
  }),
  ...[3190, 4020, 5060, 6100].map((cue, index) => Object.freeze({
    id: 'panel-blow-' + (index + 2), title: 'Latched outage ' + (index + 2),
    detail: 'A discrete loss of sync leaves surviving parts of the actual page visible.',
    status: 'critical', offsetMs: cue + (index === 0 ? 110 : 230),
  })),
  Object.freeze({
    id: 'blackout', title: 'Display off · a real pause',
    detail: 'A fully opaque loss of signal separates the page from the damaged recovery display.',
    status: 'critical', offsetMs: GLOBAL_SENTINEL_ENTRY_STAGES.POWER_CUT + 300,
  }),
  Object.freeze({
    id: 'false-calm', title: 'False calm · nothing approaches yet',
    detail: 'The original fracture remains on the dark damaged display; no white recovery has happened yet.',
    status: 'entry', offsetMs: GLOBAL_SENTINEL_ENTRY_STAGES.WHITE_FIELD + 1100,
  }),
  Object.freeze({
    id: 'recovery-cover',
    title: 'Return · the same koi, already enormous',
    detail: 'The departed sentinel returns already enormous; white backlight follows its head into the damaged display.',
    status: 'repair', offsetMs: GLOBAL_SENTINEL_ENTRY_STAGES.GIANT_RETURN + 1500,
  }),
  Object.freeze({
    id: 'recovery-rewind',
    title: 'Mass · the viewport no longer contains it',
    detail: 'The same body writes the white surface at its head and seals the fixed glass network at its tail.',
    status: 'repair', offsetMs: GLOBAL_SENTINEL_ENTRY_STAGES.GIANT_RETURN + 4200,
  }),
  Object.freeze({
    id: 'recovery-wake',
    title: 'Recovery · a damaged core remains',
    detail: 'The giant silhouette leaves behind the same fracture, partially repaired.',
    status: 'repair', offsetMs: GLOBAL_SENTINEL_ENTRY_STAGES.REPAIR_COMPLETE + 100,
  }),
  Object.freeze({
    id: 'entry-complete',
    index: '07',
    title: `Entry complete · +${GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS} ms`,
    detail: 'The complete 18.5-second introduction ends before the first repair contact can approach.',
    status: 'fracture',
    offsetMs: GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS,
  }),
]);

const GLOBAL_SENTINEL_CUE_FRAMES = Object.freeze([
  Object.freeze({
    id: 'repair-approach',
    index: '08',
    title: 'Repair intent · approach',
    detail: 'A live production Sentinel carries the system repair intent toward the open fracture.',
    status: 'target',
    telegraphMin: 0.58,
    telegraphMax: 0.68,
    vulnerable: false,
  }),
  Object.freeze({
    id: 'repair-contact',
    index: '09',
    title: 'Repair contact · lock contracts',
    detail: 'The sentinel settles at the actual fracture segment while its repair patch closes beneath the head.',
    status: 'activation',
    telegraphMin: 0.9,
    telegraphMax: 0.98,
    vulnerable: false,
  }),
  Object.freeze({
    id: 'rupture-window',
    index: '10',
    title: 'Rupture window · intervention open',
    detail: 'The contact becomes actionable while the production world slows enough to read the cause and effect.',
    status: 'critical',
    vulnerabilityProgressMin: 0.28,
    vulnerable: true,
  }),
  Object.freeze({
    id: 'miss-seal',
    index: '11',
    title: 'Miss · repair completes',
    detail: 'The contacted seam seals and fresh outer damage retracts; the stable fracture remains.',
    status: 'repair',
  }),
]);

const GLOBAL_SENTINEL_ACT_FRAMES = Object.freeze([
  Object.freeze({ id: 'system-surge', title: 'Act II · the system answers',
    detail: 'A new repair approach follows the first accepted action and its full aftermath breath.',
    status: 'repair', actIndex: 1 }),
  Object.freeze({ id: 'final-decision', title: 'Act III · one deliberate decision',
    detail: 'The final system response keeps one contact in a long suspended input window.',
    status: 'critical', actIndex: 2 }),
]);

const GLOBAL_SENTINEL_FRONT_FRAMES = Object.freeze([
  { id: 'contact-release', title: 'Accepted contact · +0 ms', elapsedMs: 0 },
  { id: 'first-front', title: 'First presented fracture · +16 ms', elapsedMs: 16 },
  { id: 'front-arrest', title: 'Arrested tips · +70 ms', elapsedMs: 70 },
  { id: 'second-front', title: 'Optical settling · +240 ms', elapsedMs: 240 },
  { id: 'front-settled', title: 'Accepted fracture remains · +440 ms', elapsedMs: 440 },
].map(frame => Object.freeze({ ...frame, status: 'fracture',
  detail: 'One accepted hit commits its arrested tips immediately; subsequent contact light changes without extending the glass.' })));

const GLOBAL_SENTINEL_SUCCESS_FRAMES = Object.freeze([
  Object.freeze({
    id: 'hit-2',
    index: '12',
    title: 'Discovery · repair breaks at the contact',
    detail: 'The production pointer hit-test admits a local intervention and the existing branch reopens.',
    status: 'fracture',
    aftermathPhase: GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES.FRACTURE,
    aftermathProgress: 0.18,
    impactMode: 'off-centre-engine-pointer-hit',
  }),
  Object.freeze({
    id: 'hit-3',
    index: '13',
    title: 'Surge · repair interrupted again',
    detail: 'A further accepted intervention restores fracture lost during the visible repair approach.',
    status: 'fracture',
    aftermathPhase: GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES.FRACTURE,
    aftermathProgress: 0.18,
  }),
  Object.freeze({
    id: 'final-fracture',
    index: '14',
    title: 'Final fracture · threshold open',
    detail: 'The final accepted hit opens the canonical breach and starts its terminal aftermath clock.',
    status: 'critical',
    aftermathPhase: GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES.FRACTURE,
    aftermathProgress: 0.18,
  }),
  Object.freeze({
    id: 'reverse-recall',
    index: '15',
    title: 'Local dissolution · the unit loses coherence',
    detail: 'The struck sentinel dissipates at the repair contact while its failure reaches the same fracture network.',
    status: 'activation',
    aftermathPhase: GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES.REVERSE_RECALL,
    aftermathProgress: 0.5,
  }),
  Object.freeze({
    id: 'repair-seam-annulment',
    index: '16',
    title: 'Seam annulment · fracture persists',
    detail: 'Repair authority is lost, leaving the won fracture intact as the remaining motion settles.',
    status: 'success',
    aftermathPhase: GLOBAL_SENTINEL_HIT_AFTERMATH_PHASES.REPAIR_SEAM_ANNULMENT,
    aftermathProgress: 0.82,
  }),
  Object.freeze({
    id: 'terminal-ma',
    index: '17',
    title: 'Terminal · held breath',
    detail: 'Input is closed while the won fracture holds still before anything passes through it.',
    status: 'success',
    terminalOffsetMs: GLOBAL_SENTINEL_TERMINAL_MA_MS - 40,
  }),
  Object.freeze({
    id: 'terminal-banish',
    index: '18',
    title: 'Aftermath · only the fracture remains',
    detail: 'All actor motion has ended while the original surface remains visible for the quiet ending.',
    status: 'success',
    terminalOffsetMs: 2600,
  }),
  Object.freeze({ id: 'rift-unfold', title: 'Space forms from the fracture',
    detail: 'Only after the quiet hold does the same surviving topology acquire depth.',
    status: 'success', riftOffsetMs: 620 }),
  Object.freeze({ id: 'rift-ready', title: 'The threshold remains open',
    detail: 'The completed aperture waits for an explicit invitation response; no test cleanup interrupts the ending.',
    status: 'success', riftOffsetMs: GLOBAL_SENTINEL_RIFT_APERTURE_OPEN_MS + 200 }),
]);

const GLOBAL_SENTINEL_FAILURE_FRAMES = Object.freeze([
  Object.freeze({
    id: 'failure-resync-closure',
    index: '19',
    title: 'Failure · resync closure',
    detail: 'An independent expired engine/session lets canonical resync close and bleach the fracture.',
    status: 'repair',
    terminalOffsetMs: 468,
  }),
]);

const GLOBAL_SENTINEL_FRAMES = Object.freeze([
  ...GLOBAL_SENTINEL_ENTRY_FRAMES,
  ...GLOBAL_SENTINEL_CUE_FRAMES,
  ...GLOBAL_SENTINEL_FRONT_FRAMES.slice(0, 4),
  GLOBAL_SENTINEL_SUCCESS_FRAMES[0],
  ...GLOBAL_SENTINEL_FRONT_FRAMES.slice(4),
  GLOBAL_SENTINEL_ACT_FRAMES[0],
  GLOBAL_SENTINEL_SUCCESS_FRAMES[1],
  GLOBAL_SENTINEL_ACT_FRAMES[1],
  ...GLOBAL_SENTINEL_SUCCESS_FRAMES.slice(2),
  ...GLOBAL_SENTINEL_FAILURE_FRAMES,
].map((frame, index) => ({ ...frame, index: String(index).padStart(2, '0') })));

const MATERIAL_INSPECTION_FRAMES = ['awaiting', 'shadow-detached', 'departure-cruise', 'departure-hold', 'departure-rewind', 'departure-split', 'shadow-departure', 'panel-cascade', 'panel-blow-2', 'panel-blow-3', 'panel-blow-4', 'panel-blow-5', 'false-calm',
  'recovery-cover', 'recovery-rewind', 'recovery-wake', 'entry-complete', 'repair-contact',
  ...GLOBAL_SENTINEL_FRONT_FRAMES.map(frame => frame.id),
  'rupture-window', 'miss-seal', 'system-surge', 'hit-3', 'final-decision', 'final-fracture',
  'reverse-recall', 'terminal-banish', 'rift-unfold', 'rift-ready'];

function MockLivePage({ tone = 'light' }) {
  return (
    <div
      className={`visual-global-sentinel-frame__mock-page is-${tone}`}
      aria-hidden="true"
    >
      <div className="visual-global-sentinel-frame__mock-nav">
        <span className="visual-global-sentinel-frame__mock-brand">
          <span />
          ORBITAL
        </span>
        <span className="visual-global-sentinel-frame__mock-nav-item is-active">Discover</span>
        <span className="visual-global-sentinel-frame__mock-nav-item">Following</span>
        <span className="visual-global-sentinel-frame__mock-avatar" />
      </div>
      <div className="visual-global-sentinel-frame__mock-body">
        <div className="visual-global-sentinel-frame__mock-hero">
          <span className="visual-global-sentinel-frame__mock-kicker">TODAY'S FIELD NOTES</span>
          <strong>Signals from the quiet edge</strong>
          <span className="visual-global-sentinel-frame__mock-copy" />
          <span className="visual-global-sentinel-frame__mock-copy is-short" />
          <span className="visual-global-sentinel-frame__mock-button">Read dispatch</span>
        </div>
        <div className="visual-global-sentinel-frame__mock-art" />
        <div className="visual-global-sentinel-frame__mock-card is-coral">
          <span />
          <strong>New rituals</strong>
        </div>
        <div className="visual-global-sentinel-frame__mock-card is-blue">
          <span />
          <strong>Studio log</strong>
        </div>
        <div className="visual-global-sentinel-frame__mock-card is-moss">
          <span />
          <strong>Slow systems</strong>
        </div>
      </div>
    </div>
  );
}

function GlobalSentinelFrame({ frame, registerCanvas }) {
  return (
    <article
      className="visual-global-sentinel-frame"
      data-frame-status={frame.status}
      data-visual-capture={`global-sentinel-${frame.id}`}
    >
      <header className="visual-global-sentinel-frame__header">
        <span className="visual-global-sentinel-frame__index">{frame.index}</span>
        <span className="visual-global-sentinel-frame__heading">
          <strong>{frame.title}</strong>
          <span>{frame.detail}</span>
        </span>
        <span className="visual-global-sentinel-frame__status">{frame.status}</span>
      </header>
      <div className="visual-global-sentinel-frame__screen">
        <MockLivePage tone={frame.pageTone} />
        <canvas
          ref={(canvas) => registerCanvas(frame.id, canvas)}
          aria-label={`${frame.title} production canvas`}
          data-simulation-bounds={`${CANVAS_WIDTH}x${CANVAS_HEIGHT}`}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
        />
      </div>
    </article>
  );
}

function prepareFrameContext(canvas, frameId) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) {
    throw new Error(`[VisualHarness] 2D canvas is unavailable for global sentinel frame '${frameId}'.`);
  }

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  return ctx;
}

function createDeterministicEngineClock() {
  let currentTimeMs = FIXED_TIME_MS;
  return {
    now: () => currentTimeMs,
    setTimeMs(nextTimeMs) {
      currentTimeMs = nextTimeMs;
    },
  };
}

function drawGlobalSentinelSuccessFrames(canvasByFrameId, deterministicRandom) {
  const bounds = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
  const clock = createDeterministicEngineClock();
  const engine = createNudgeSwarmEngine({
    now: clock.now,
    random: deterministicRandom,
    adaptiveRenderBudgetEnabled: false,
  });
  const protocolSession = createSentinelProtocolSessionController({
    config: GLOBAL_SENTINEL_RUNTIME_CONFIG,
    protocolScene: GLOBAL_SENTINEL_SCENE,
    now: FIXED_TIME_MS,
  });

  function publishProtocolProgress() {
    engine.setProtocolProgress(protocolSession.buildWorkerProtocolProgress({
      now: clock.now(),
    }));
  }

  function advanceSimulation(durationMs) {
    const deadlineMs = clock.now() + Math.max(0, Number(durationMs) || 0);
    while (clock.now() < deadlineMs) {
      const stepMs = Math.min(16, deadlineMs - clock.now());
      const nextTimeMs = clock.now() + stepMs;
      clock.setTimeMs(nextTimeMs);
      publishProtocolProgress();
      engine.update(stepMs / 1000, nextTimeMs, {
        frameMs: stepMs,
        sampleRenderPressure: false,
      });
    }
  }

  function renderEngineFrame(frame) {
    const canvas = canvasByFrameId.get(frame.id);
    const ctx = prepareFrameContext(canvas, frame.id);
    engine.setContext(ctx, bounds);
    publishProtocolProgress();
    engine.render(clock.now());
    const stats = engine.getStats();
    canvas.dataset.sequenceElapsedMs = String(clock.now() - ENTRY_ACTIVATION_TIME_MS);
    canvas.dataset.gamePhase = stats.globalSentinelGamePhase;
    canvas.dataset.liveCount = String(stats.liveCount);
    return stats;
  }

  function resolveEntityById(entityId) {
    return engine._debugGetEntities().find((entity) => (
      Number(entity?.entityId) === Number(entityId)
    )) || null;
  }

  function advanceUntilEntityCue(entityId, predicate, label, maxAdvanceMs = 12_000) {
    const deadlineMs = clock.now() + maxAdvanceMs;
    while (clock.now() < deadlineMs) {
      const entity = resolveEntityById(entityId);
      if (!entity) {
        throw new Error(`[VisualHarness] global sentinel '${label}' cue entity retired early.`);
      }
      if (predicate(entity)) return entity;
      advanceSimulation(Math.min(16, deadlineMs - clock.now()));
    }
    throw new Error(`[VisualHarness] global sentinel '${label}' cue deadline expired.`);
  }

  function advanceUntilGlobalTarget(label, {
    maxAdvanceMs = 6000,
    vulnerableOnly = false,
  } = {}) {
    const deadlineMs = clock.now() + maxAdvanceMs;
    while (clock.now() < deadlineMs) {
      const eligibility = engine.handleEligibleGlobalTarget({ commit: false });
      const entity = resolveEntityById(eligibility?.targetId);
      if (
        eligibility.hit
        && Number(eligibility.targetId) > 0
        && (!vulnerableOnly || entity?.globalSentinelVulnerable === true)
      ) {
        return eligibility;
      }
      advanceSimulation(Math.min(16, deadlineMs - clock.now()));
    }
    throw new Error(`[VisualHarness] global sentinel '${label}' rhythm target deadline expired.`);
  }

  function renderCueFrame(frame, entityId) {
    const entity = resolveEntityById(entityId);
    if (!entity) {
      throw new Error(`[VisualHarness] global sentinel '${frame.id}' cue entity is unavailable.`);
    }
    const telegraph = Number(entity.globalSentinelVulnerabilityTelegraphProgress) || 0;
    const vulnerabilityProgress = Number(entity.globalSentinelVulnerabilityProgress) || 0;
    if (
      entity.globalSentinelVulnerable !== frame.vulnerable
      || (Number.isFinite(frame.telegraphMin) && telegraph < frame.telegraphMin)
      || (Number.isFinite(frame.telegraphMax) && telegraph > frame.telegraphMax)
      || (
        Number.isFinite(frame.vulnerabilityProgressMin)
        && vulnerabilityProgress < frame.vulnerabilityProgressMin
      )
    ) {
      throw new Error(`[VisualHarness] global sentinel cue drifted at '${frame.id}'.`);
    }
    return renderEngineFrame(frame);
  }

  function renderResistanceActFrame(frame) {
    const deadlineMs = clock.now() + 14_000;
    while (clock.now() < deadlineMs) {
      const progress = protocolSession.resolveProgress({ now: clock.now() });
      const targetPhase = frame.actIndex === 2 ? 'active' : 'approach';
      const targetProgress = frame.actIndex === 2 ? 0.34 : 0.58;
      if (progress.rhythmActIndex === frame.actIndex
        && progress.rhythmPhase === targetPhase
        && progress.rhythmPhaseProgress >= targetProgress) {
        const stats = renderEngineFrame(frame);
        if (stats.liveCount !== 1) {
          throw new Error(`[VisualHarness] '${frame.id}' must retain exactly one repair contact.`);
        }
        return;
      }
      advanceSimulation(Math.min(16, deadlineMs - clock.now()));
    }
    throw new Error(`[VisualHarness] action-relative '${frame.id}' did not reach its canonical act.`);
  }

  function resolveOffCentrePointerOutcome(label) {
    const eligibility = engine.handleEligibleGlobalTarget({ commit: false });
    const target = engine._debugGetEntities().find((entity) => (
      Number(entity?.entityId) === Number(eligibility?.targetId)
    ));
    if (!eligibility.hit || !target) {
      throw new Error(`[VisualHarness] global sentinel '${label}' pointer target is unavailable.`);
    }
    const sourceX = Number(target.x);
    const sourceY = Number(target.y);
    const sourceHeading = Math.atan2(Number(target.vy) || 0, Number(target.vx) || 1);
    const sourceSize = Math.max(1, Number(target.size) || 1);
    const pointerOffsetPx = Math.max(4, Math.min(10, sourceSize * 0.12));
    const candidates = [
      sourceHeading + Math.PI,
      sourceHeading,
      sourceHeading + Math.PI / 2,
      sourceHeading - Math.PI / 2,
    ].map((heading) => ({
      x: sourceX + Math.cos(heading) * pointerOffsetPx,
      y: sourceY + Math.sin(heading) * pointerOffsetPx,
    }));
    let pointer = null;
    for (const candidate of candidates) {
      const pointerProbe = engine.handlePointer({
        ...candidate,
        commit: false,
      });
      if (pointerProbe.hit) {
        pointer = candidate;
        break;
      }
    }
    if (!pointer) {
      throw new Error(`[VisualHarness] global sentinel '${label}' off-centre hit-test failed.`);
    }
    const outcome = engine.handlePointer(pointer);
    return {
      outcome,
      pointerEvidence: Object.freeze({
        impactX: pointer.x,
        impactY: pointer.y,
        sourceX,
        sourceY,
        semanticActivation: false,
      }),
    };
  }

  function commitEligibleTarget(label, { offCentrePointer = false } = {}) {
    advanceUntilGlobalTarget(label, { vulnerableOnly: offCentrePointer });
    const candidate = offCentrePointer
      ? resolveOffCentrePointerOutcome(label)
      : { outcome: engine.handleEligibleGlobalTarget(), pointerEvidence: null };
    const { outcome, pointerEvidence } = candidate;
    if (!outcome.hit || outcome.committed !== true) {
      throw new Error(`[VisualHarness] global sentinel '${label}' target was not committed.`);
    }
    const sessionAdvance = protocolSession.advanceAcceptedInput({
      now: outcome.acceptedAtMs,
      hitEfficiency: outcome.hitEfficiency,
      expectedGlobalOutcome: outcome.protocolOutcome,
    });
    if (!sessionAdvance.advanced || sessionAdvance.rejected) {
      throw new Error(`[VisualHarness] global sentinel session rejected '${label}'.`);
    }
    if (pointerEvidence) {
      const impactSerial = Math.round(Number(outcome.protocolOutcome?.fractureImpactSerial));
      const burst = engine._debugGetGlobalSentinelInkBursts().find((entry) => (
        Number(entry?.impactSerial) === impactSerial
      ));
      const pointerSeparationPx = Math.hypot(
        pointerEvidence.impactX - pointerEvidence.sourceX,
        pointerEvidence.impactY - pointerEvidence.sourceY,
      );
      const burstSeparationPx = Math.hypot(
        Number(burst?.impactX) - Number(burst?.sourceX),
        Number(burst?.impactY) - Number(burst?.sourceY),
      );
      if (
        pointerEvidence.semanticActivation !== false
        || !(pointerSeparationPx >= 4)
        || !(burstSeparationPx >= 4)
      ) {
        throw new Error(`[VisualHarness] global sentinel '${label}' impact collapsed onto its actor source.`);
      }
    }
    publishProtocolProgress();
    return { outcome, pointerEvidence, sessionAdvance };
  }

  function assertAftermathFrame(frame, stats, {
    serial,
    terminal,
    gamePhase,
  }) {
    if (
      stats.globalSentinelHitAftermathActiveCount !== 1
      || stats.globalSentinelHitAftermathPhase !== frame.aftermathPhase
      || stats.globalSentinelHitAftermathTerminal !== terminal
      || stats.globalSentinelHitAftermathSerial !== serial
      || stats.globalSentinelGamePhase !== gamePhase
      || Math.abs(
        stats.globalSentinelHitAftermathProgress - frame.aftermathProgress
      ) > 0.002
    ) {
      throw new Error(`[VisualHarness] global sentinel aftermath drifted at '${frame.id}'.`);
    }
  }

  try {
    const awaitingFrame = GLOBAL_SENTINEL_ENTRY_FRAMES[0];
    const awaitingCanvas = canvasByFrameId.get(awaitingFrame.id);
    const awaitingCtx = prepareFrameContext(awaitingCanvas, awaitingFrame.id);

    clock.setTimeMs(FIXED_TIME_MS);
    engine.init({
      ctx: awaitingCtx,
      bounds,
      config: GLOBAL_SENTINEL_RUNTIME_CONFIG,
      themeId: 'zen',
      protocolStartAt: FIXED_TIME_MS,
      protocolProgress: protocolSession.buildWorkerProtocolProgress({
        now: FIXED_TIME_MS,
      }),
    });
    engine.ensureInitialSchool();
    engine.update(0, FIXED_TIME_MS, {
      frameMs: 16.67,
      sampleRenderPressure: false,
    });
    // The production actor emerges over 900ms. Capture its actual completed
    // emergence, not the red head mark on the first frame of its lifetime.
    advanceSimulation(awaitingFrame.engineTimeMs - FIXED_TIME_MS);
    engine.render(awaitingFrame.engineTimeMs);

    const awaitingStats = engine.getStats();
    if (
      awaitingStats.globalSentinelGamePhase !== GLOBAL_SENTINEL_GAME_PHASES.AWAITING_START
      || awaitingStats.liveCount !== 1
    ) {
      throw new Error('[VisualHarness] global sentinel entry did not produce exactly one awaiting starter.');
    }

    const hoverFrame = GLOBAL_SENTINEL_ENTRY_FRAMES[1];
    advanceSimulation(hoverFrame.engineTimeMs - clock.now());
    const starter = engine._debugGetEntities()[0];
    const probe = engine.handlePointer({ x: starter?.x, y: starter?.y, commit: false });
    if (!probe.hit || probe.committed !== false) {
      throw new Error('[VisualHarness] global sentinel starter rejected its production hover probe.');
    }
    const hoverCanvas = canvasByFrameId.get(hoverFrame.id);
    const hoverCtx = prepareFrameContext(hoverCanvas, hoverFrame.id);
    engine.setContext(hoverCtx, bounds);
    engine.render(hoverFrame.engineTimeMs);

    const starterHitRadius = Math.max(1, Number(starter.hitRadius) || Number(starter.size) * 0.5);
    const starterHeading = Math.atan2(Number(starter.vy) || 0, Number(starter.vx) || 1);
    const activationInset = Math.min(10, starterHitRadius * 0.25);
    const activationPoint = {
      x: Number(starter.x) - Math.cos(starterHeading) * activationInset,
      y: Number(starter.y) - Math.sin(starterHeading) * activationInset,
    };
    const activationOffset = Math.hypot(
      activationPoint.x / CANVAS_WIDTH - 0.5,
      activationPoint.y / CANVAS_HEIGHT - 0.5,
    );
    if (activationOffset < 0.08) {
      throw new Error('[VisualHarness] deterministic global sentinel activation point is not off-centre.');
    }

    clock.setTimeMs(ENTRY_ACTIVATION_TIME_MS);
    const activation = engine.handlePointer({
      x: activationPoint.x,
      y: activationPoint.y,
    });
    if (!activation.hit) {
      throw new Error('[VisualHarness] global sentinel starter activation was not committed.');
    }
    const sessionAdvance = protocolSession.advanceAcceptedInput({
      now: activation.acceptedAtMs,
      hitEfficiency: activation.hitEfficiency,
      expectedGlobalOutcome: activation.protocolOutcome,
    });
    if (!sessionAdvance.advanced || sessionAdvance.rejected) {
      throw new Error('[VisualHarness] global sentinel session rejected its production activation outcome.');
    }
    engine.setProtocolProgress(protocolSession.buildWorkerProtocolProgress({
      now: activation.acceptedAtMs,
    }));

    GLOBAL_SENTINEL_ENTRY_FRAMES.slice(2).forEach((frame) => {
      const timeMs = ENTRY_ACTIVATION_TIME_MS + frame.offsetMs;
      advanceSimulation(timeMs - clock.now());
      const canvas = canvasByFrameId.get(frame.id);
      const ctx = prepareFrameContext(canvas, frame.id);
      engine.setContext(ctx, bounds);
      engine.render(timeMs);

      const expectedReveal = Math.min(
        1,
        frame.offsetMs / GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS,
      );
      const actualReveal = engine.getStats().globalSentinelEntryRevealProgress;
      if (Math.abs(actualReveal - expectedReveal) > 0.0001) {
        throw new Error(`[VisualHarness] global sentinel entry reveal drifted at '${frame.id}'.`);
      }
    });

    const cuePolicy = resolveGlobalSentinelSimulationPolicy(GLOBAL_SENTINEL_RUNTIME_CONFIG);
    advanceSimulation(cuePolicy.vulnerabilityInitialDelayMs - cuePolicy.vulnerabilityApproachMs
      - GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS + 16);
    const cueEligibility = engine.handleEligibleGlobalTarget({ commit: false });
    const cueEntityId = Number(cueEligibility?.targetId);
    if (!cueEligibility.hit || !(cueEntityId > 0)) {
      throw new Error('[VisualHarness] global sentinel repair cue target was not materialized.');
    }
    const [
      repairApproachFrame,
      repairContactFrame,
      ruptureWindowFrame,
      missSealFrame,
    ] = GLOBAL_SENTINEL_CUE_FRAMES;
    advanceUntilEntityCue(
      cueEntityId,
      (entity) => (
        entity.globalSentinelVulnerable !== true
        && Number(entity.globalSentinelVulnerabilityTelegraphProgress) >= repairApproachFrame.telegraphMin
      ),
      repairApproachFrame.id,
    );
    renderCueFrame(repairApproachFrame, cueEntityId);
    advanceUntilEntityCue(
      cueEntityId,
      (entity) => (
        entity.globalSentinelVulnerable !== true
        && Number(entity.globalSentinelVulnerabilityTelegraphProgress) >= repairContactFrame.telegraphMin
      ),
      repairContactFrame.id,
    );
    renderCueFrame(repairContactFrame, cueEntityId);
    advanceUntilEntityCue(
      cueEntityId,
      (entity) => (
        entity.globalSentinelVulnerable === true
        && Number(entity.globalSentinelVulnerabilityProgress) >= ruptureWindowFrame.vulnerabilityProgressMin
      ),
      ruptureWindowFrame.id,
    );
    renderCueFrame(ruptureWindowFrame, cueEntityId);

    const preMissStats = engine.getStats();
    const rhythmAtWindow = resolveGlobalSentinelRhythmState(
      protocolSession.getStateSnapshot().globalSentinelSimulationState,
      GLOBAL_SENTINEL_RUNTIME_CONFIG,
      { now: clock.now() },
    );
    const missRepairMidpointAtMs = Number(rhythmAtWindow.activeEndAtMs) + cuePolicy.missRepairDurationMs * 0.5;
    advanceSimulation(missRepairMidpointAtMs - clock.now());
    const missStats = renderEngineFrame(missSealFrame);
    if (
      missStats.globalSentinelMissCount !== 1
      || missStats.globalSentinelFractureRepairPressure < 0.9
      || missStats.globalSentinelFracture >= preMissStats.globalSentinelFracture
      || missStats.globalSentinelFracture <= missStats.globalSentinelStableFracture
    ) {
      throw new Error('[VisualHarness] global sentinel miss did not produce bounded outer-fracture sealing.');
    }

    const secondHitFrame = GLOBAL_SENTINEL_SUCCESS_FRAMES[0];
    const secondHit = commitEligibleTarget(secondHitFrame.id, { offCentrePointer: true });
    const secondHitSerial = Math.round(Number(secondHit.outcome.protocolOutcome.fractureImpactSerial));
    const secondHitAtMs = clock.now();
    const frontFrames = [...GLOBAL_SENTINEL_FRONT_FRAMES,
      { ...secondHitFrame, elapsedMs: GLOBAL_SENTINEL_HIT_AFTERMATH_MS * secondHitFrame.aftermathProgress }]
      .sort((a, b) => a.elapsedMs - b.elapsedMs);
    for (const frame of frontFrames) {
      advanceSimulation(secondHitAtMs + frame.elapsedMs - clock.now());
      const stats = renderEngineFrame(frame);
      if (stats.globalSentinelHitAftermathSerial !== secondHitSerial
        || stats.globalSentinelHitAftermathActiveCount !== 1) {
        throw new Error(`[VisualHarness] accepted fracture front lost its owning hit at '${frame.id}'.`);
      }
      if (frame.id === secondHitFrame.id) assertAftermathFrame(secondHitFrame, stats, {
        serial: secondHitSerial, terminal: false, gamePhase: GLOBAL_SENTINEL_GAME_PHASES.REPAIR_RACE,
      });
    }
    advanceSimulation(secondHitAtMs + GLOBAL_SENTINEL_HIT_AFTERMATH_MS + 16 - clock.now());
    if (engine.getStats().globalSentinelHitAftermathActiveCount !== 0) {
      throw new Error('[VisualHarness] second global sentinel aftermath did not settle before impact three.');
    }

    renderResistanceActFrame(GLOBAL_SENTINEL_ACT_FRAMES[0]);
    const thirdHitFrame = GLOBAL_SENTINEL_SUCCESS_FRAMES[1];
    const thirdHit = commitEligibleTarget(thirdHitFrame.id);
    const thirdHitSerial = Math.round(Number(thirdHit.outcome.protocolOutcome.fractureImpactSerial));
    if (thirdHit.sessionAdvance.completed) {
      throw new Error('[VisualHarness] repair-race evidence unexpectedly completed on impact three.');
    }
    advanceSimulation(GLOBAL_SENTINEL_HIT_AFTERMATH_MS * thirdHitFrame.aftermathProgress);
    const thirdHitStats = renderEngineFrame(thirdHitFrame);
    assertAftermathFrame(thirdHitFrame, thirdHitStats, {
      serial: thirdHitSerial,
      terminal: false,
      gamePhase: GLOBAL_SENTINEL_GAME_PHASES.REPAIR_RACE,
    });
    advanceSimulation(
      GLOBAL_SENTINEL_HIT_AFTERMATH_MS * (1 - thirdHitFrame.aftermathProgress) + 16,
    );
    if (engine.getStats().globalSentinelHitAftermathActiveCount !== 0) {
      throw new Error('[VisualHarness] third global sentinel aftermath did not settle before the final hit.');
    }

    renderResistanceActFrame(GLOBAL_SENTINEL_ACT_FRAMES[1]);
    const finalHit = commitEligibleTarget('final-fracture');
    if (!finalHit.sessionAdvance.completed) {
      throw new Error('[VisualHarness] final global sentinel hit did not open the success fracture.');
    }
    const finalHitAtMs = clock.now();
    const finalHitSerial = Math.round(Number(finalHit.outcome.protocolOutcome.fractureImpactSerial));
    for (const frame of GLOBAL_SENTINEL_SUCCESS_FRAMES.slice(2, 5)) {
      const targetTimeMs = finalHitAtMs
        + GLOBAL_SENTINEL_FINAL_HIT_AFTERMATH_MS * frame.aftermathProgress;
      advanceSimulation(targetTimeMs - clock.now());
      const stats = renderEngineFrame(frame);
      assertAftermathFrame(frame, stats, {
        serial: finalHitSerial,
        terminal: true,
        gamePhase: GLOBAL_SENTINEL_GAME_PHASES.FRACTURE_OPEN,
      });
      if (stats.globalSentinelFracture < stats.globalSentinelFractureThreshold) {
        throw new Error(`[VisualHarness] success fracture closed during '${frame.id}'.`);
      }
    }

    const completedState = protocolSession.getStateSnapshot().globalSentinelSimulationState;
    const readyAtMs = Number(completedState?.readyAtMs);
    if (!Number.isSafeInteger(readyAtMs) || readyAtMs <= finalHitAtMs) {
      throw new Error('[VisualHarness] global sentinel success readyAt boundary is invalid.');
    }
    advanceSimulation(readyAtMs - clock.now());
    const readyProgress = protocolSession.resolveProgress({ now: readyAtMs });
    if (
      clock.now() !== readyAtMs
      || readyProgress.ready !== true
      || readyProgress.readyAtMs !== readyAtMs
      || readyProgress.timeProgress !== 1
      || readyProgress.outcome !== 'success'
      || protocolSession.resolveCompletionDelayMs({ now: readyAtMs }) !== 0
    ) {
      throw new Error('[VisualHarness] global sentinel success did not reach its exact readyAt boundary.');
    }
    const completionStats = engine.getStats();
    if (
      completionStats.globalSentinelHitAftermathActiveCount !== 0
      || completionStats.globalSentinelFracture < completionStats.globalSentinelFractureThreshold
    ) {
      throw new Error('[VisualHarness] global sentinel success aftermath did not end on an open fracture.');
    }

    protocolSession.markActiveCompletedReady({ now: clock.now() });
    publishProtocolProgress();
    const terminalMaFrame = GLOBAL_SENTINEL_SUCCESS_FRAMES[5];
    const terminalFrame = GLOBAL_SENTINEL_SUCCESS_FRAMES[6];
    const terminalSequence = createNudgeTerminalSequenceState({
      outcome: 'success',
      now: clock.now(),
    });
    engine.setTerminalSequence(terminalSequence);
    engine.setScenePhase(terminalSequence.scenePhase);
    advanceSimulation(terminalMaFrame.terminalOffsetMs);
    const terminalMaStats = renderEngineFrame(terminalMaFrame);
    if (
      terminalMaStats.globalSentinelGamePhase !== GLOBAL_SENTINEL_GAME_PHASES.FRACTURE_OPEN
      || terminalMaStats.globalSentinelFracture < terminalMaStats.globalSentinelFractureThreshold
      || terminalMaStats.globalSentinelHitAftermathActiveCount !== 0
    ) {
      throw new Error('[VisualHarness] terminal ma no longer preserves the won fracture.');
    }
    advanceSimulation(terminalFrame.terminalOffsetMs - terminalMaFrame.terminalOffsetMs);
    const terminalStats = renderEngineFrame(terminalFrame);
    if (
      terminalStats.globalSentinelGamePhase !== GLOBAL_SENTINEL_GAME_PHASES.FRACTURE_OPEN
      || terminalStats.globalSentinelFracture < terminalStats.globalSentinelFractureThreshold
      || terminalStats.globalSentinelHitAftermathActiveCount !== 0
    ) {
      throw new Error('[VisualHarness] terminal banish no longer preserves the won fracture.');
    }
    advanceSimulation(getNudgeTerminalSequenceTotalMs(terminalSequence)
      - terminalFrame.terminalOffsetMs);
    engine.setTerminalSequence(null, { clearEntities: true });
    engine.setScenePhase(NUDGE_SCENE_PHASES.RIFT);
    const riftStartedAtMs = clock.now();
    for (const frame of GLOBAL_SENTINEL_SUCCESS_FRAMES.slice(7)) {
      advanceSimulation(riftStartedAtMs + frame.riftOffsetMs - clock.now());
      const stats = renderEngineFrame(frame);
      if (stats.liveCount !== 0 || stats.globalSentinelFracture < stats.globalSentinelFractureThreshold) {
        throw new Error(`[VisualHarness] '${frame.id}' lost the completed fracture or revived a sentinel.`);
      }
    }
  } finally {
    engine.destroy();
  }
}

function drawGlobalSentinelFailureFrame(canvas, deterministicRandom) {
  const frame = GLOBAL_SENTINEL_FAILURE_FRAMES[0];
  const bounds = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
  const clock = createDeterministicEngineClock();
  const ctx = prepareFrameContext(canvas, frame.id);
  const engine = createNudgeSwarmEngine({
    now: clock.now,
    random: deterministicRandom,
    adaptiveRenderBudgetEnabled: false,
  });
  const protocolSession = createSentinelProtocolSessionController({
    config: GLOBAL_SENTINEL_RUNTIME_CONFIG,
    protocolScene: GLOBAL_SENTINEL_SCENE,
    now: FIXED_TIME_MS,
  });

  function publishProtocolProgress() {
    engine.setProtocolProgress(protocolSession.buildWorkerProtocolProgress({
      now: clock.now(),
    }));
  }

  function advanceSimulation(durationMs) {
    const deadlineMs = clock.now() + Math.max(0, Number(durationMs) || 0);
    while (clock.now() < deadlineMs) {
      const stepMs = Math.min(16, deadlineMs - clock.now());
      const nextTimeMs = clock.now() + stepMs;
      clock.setTimeMs(nextTimeMs);
      publishProtocolProgress();
      engine.update(stepMs / 1000, nextTimeMs, {
        frameMs: stepMs,
        sampleRenderPressure: false,
      });
    }
  }

  try {
    engine.init({
      ctx,
      bounds,
      config: GLOBAL_SENTINEL_RUNTIME_CONFIG,
      themeId: 'zen',
      protocolStartAt: FIXED_TIME_MS,
      protocolProgress: protocolSession.buildWorkerProtocolProgress({ now: FIXED_TIME_MS }),
    });
    engine.ensureInitialSchool();
    engine.update(0, FIXED_TIME_MS, { frameMs: 16.67, sampleRenderPressure: false });

    const starterOutcome = engine.handleEligibleGlobalTarget();
    if (!starterOutcome.hit || starterOutcome.committed !== true) {
      throw new Error('[VisualHarness] global sentinel failure starter was not committed.');
    }
    const sessionAdvance = protocolSession.advanceAcceptedInput({
      now: starterOutcome.acceptedAtMs,
      hitEfficiency: starterOutcome.hitEfficiency,
      expectedGlobalOutcome: starterOutcome.protocolOutcome,
    });
    if (!sessionAdvance.advanced || sessionAdvance.rejected || sessionAdvance.completed) {
      throw new Error('[VisualHarness] global sentinel failure session rejected its starter.');
    }
    publishProtocolProgress();

    const activeProgress = protocolSession.resolveProgress({ now: clock.now() });
    const failureAtMs = clock.now() + Number(activeProgress.remainingMs);
    if (!Number.isSafeInteger(failureAtMs) || failureAtMs <= clock.now()) {
      throw new Error('[VisualHarness] global sentinel failure boundary is invalid.');
    }
    advanceSimulation(failureAtMs - clock.now());
    const failure = protocolSession.checkGlobalFailure({ now: failureAtMs });
    if (!failure.failed || failure.progress.failed !== true || failure.progress.outcome !== 'failure') {
      throw new Error('[VisualHarness] global sentinel session did not reach canonical failure.');
    }
    publishProtocolProgress();
    const failedStats = engine.getStats();
    if (failedStats.globalSentinelGamePhase !== GLOBAL_SENTINEL_GAME_PHASES.RESYNC_COMPLETE) {
      throw new Error('[VisualHarness] global sentinel engine did not reach resync completion.');
    }

    const terminalSequence = createNudgeTerminalSequenceState({
      outcome: 'failure',
      now: failureAtMs,
    });
    engine.setTerminalSequence(terminalSequence);
    engine.setScenePhase(terminalSequence.scenePhase);
    advanceSimulation(frame.terminalOffsetMs);
    engine.render(clock.now());
    const terminalStats = engine.getStats();
    if (
      terminalStats.globalSentinelGamePhase !== GLOBAL_SENTINEL_GAME_PHASES.RESYNC_COMPLETE
      || terminalStats.globalSentinelHitAftermathActiveCount !== 0
      || terminalStats.globalSentinelFracture >= terminalStats.globalSentinelFractureThreshold
    ) {
      throw new Error('[VisualHarness] production failure terminal did not preserve resync closure.');
    }
  } finally {
    engine.destroy();
  }
}

function GlobalSentinelSequenceScene({ signalReady }) {
  const canvasByFrameIdRef = useRef(new Map());

  const registerCanvas = React.useCallback((frameId, canvas) => {
    if (canvas) canvasByFrameIdRef.current.set(frameId, canvas);
    else canvasByFrameIdRef.current.delete(frameId);
  }, []);

  useLayoutEffect(() => {
    GLOBAL_SENTINEL_FRAMES.forEach((frame) => {
      const canvas = canvasByFrameIdRef.current.get(frame.id);
      if (!canvas) {
        throw new Error(`[VisualHarness] global sentinel frame '${frame.id}' did not mount a canvas.`);
      }
    });
    withDeterministicMathRandom(0x478, (deterministicRandom) => {
      drawGlobalSentinelSuccessFrames(canvasByFrameIdRef.current, deterministicRandom);
    });
    withDeterministicMathRandom(0x479, (deterministicRandom) => {
      const failureFrame = GLOBAL_SENTINEL_FAILURE_FRAMES[0];
      drawGlobalSentinelFailureFrame(
        canvasByFrameIdRef.current.get(failureFrame.id),
        deterministicRandom,
      );
    });
    MATERIAL_INSPECTION_FRAMES.forEach(id => {
      const source = canvasByFrameIdRef.current.get(id);
      const destination = canvasByFrameIdRef.current.get('material-' + id);
      const context = prepareFrameContext(destination, 'material-' + id);
      context.drawImage(source, 0, 0);
    });
    signalReady();
  }, [signalReady]);

  return (
    <main className="visual-global-sentinel-page">
      <section
        className="visual-global-sentinel-sequence"
        data-visual-capture="global-sentinel-sequence"
        aria-label="Global Sentinel production entry and simulation-break filmstrip"
      >
        <header className="visual-global-sentinel-sequence__header">
          <span className="visual-global-sentinel-sequence__eyebrow">
            SENTINEL / GLOBAL ENTRY + SIMULATION BREAK
          </span>
          <h1>One surface. {GLOBAL_SENTINEL_FRAMES.length} cinematic states.</h1>
          <p>
            Fixed seed 0 · 16-second revelation · three action-relative acts · complete quiet ending
          </p>
        </header>
        <div className="visual-global-sentinel-sequence__filmstrip">
          {GLOBAL_SENTINEL_FRAMES.map((frame) => (
            <GlobalSentinelFrame
              key={frame.id}
              frame={frame}
              registerCanvas={registerCanvas}
            />
          ))}
        </div>
      </section>
      <section className="visual-global-sentinel-material" aria-label="Native resolution LCD material inspection">
        {MATERIAL_INSPECTION_FRAMES.map(id => (
          <GlobalSentinelFrame
            key={id}
            frame={{ ...GLOBAL_SENTINEL_FRAMES.find(frame => frame.id === id), id: 'material-' + id }}
            registerCanvas={registerCanvas}
          />
        ))}
      </section>
    </main>
  );
}

export default defineVisualSceneImplementation({
  Component: GlobalSentinelSequenceScene,
});
