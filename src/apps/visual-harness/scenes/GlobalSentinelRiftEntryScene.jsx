import React, { useLayoutEffect } from 'react';

import { resolveNudgeTheme } from '../../../domains/nudge/nudge/nudgeVisuals.js';
import {
  GLOBAL_SENTINEL_GAME_PHASES,
  GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
} from '../../../domains/nudge/nudge/nudgeGameGlobalSentinelProtocol.js';
import {
  NUDGE_SCENE_PHASES,
} from '../../../domains/nudge/nudge/nudgeGameScene.js';
import {
  drawNudgeProtocolSceneBackground,
  drawNudgeProtocolSceneForeground,
  resolveGlobalSentinelRiftAperturePlan,
} from '../../../domains/nudge/rendering/NudgeProtocolSceneBackground.js';
import NudgeOverlayHost from '../../../domains/nudge/runtime/NudgeOverlayHost.js';
import {
  applyGlobalRiftTargetDom,
} from '../../../domains/nudge/runtime/SentinelProtocolPresentationAdapter.js';
import {
  createSentinelProtocolPresentationController,
} from '../../../domains/nudge/runtime/SentinelProtocolPresentationController.js';
import {
  SENTINEL_PROTOCOL_GLOBAL_RIFT_INVITE_MS,
} from '../../../domains/nudge/runtime/SentinelProtocolTerminalController.js';
import {
  resolveNudgeProtocolScene,
} from '../../../domains/nudge/protocols/nudgeProtocolScene.js';
import {
  DEFAULT_NUDGE_RUNTIME_TUNING,
  normalizeNudgeRuntimeConfig,
} from '../../../domains/settings/config/nudgeConfig.js';
import { resolveNudgeRenderBudget } from '../../../domains/nudge/rendering/nudgeRenderBudget.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import './globalSentinelRiftEntryScene.css';

const FIXED_TIME_MS = 1_730_000_007_478;
const SIMULATION_BREAK_SEED = 0;
const SIMULATION_BREAK_IMPACT_POINT = Object.freeze({ x: 0.54, y: 0.55 });
const RIFT_FRACTURE = 0.72;
const RIFT_SYNC_PRESSURE = 0.34;
const NORMAL_RENDER_BUDGET = resolveNudgeRenderBudget('normal');

const GLOBAL_SENTINEL_RIFT_CONFIG = Object.freeze(normalizeNudgeRuntimeConfig({
  protocolScope: 'global',
  protocolVariant: 'global_sentinel',
  protocolIntensity: 0.88,
  escalationReason: 'global_budget',
  simulationBreakSeed: SIMULATION_BREAK_SEED,
  hudVisible: false,
}, {
  defaults: DEFAULT_NUDGE_RUNTIME_TUNING,
}));

const GLOBAL_SENTINEL_RIFT_SCENE = Object.freeze(resolveNudgeProtocolScene(
  GLOBAL_SENTINEL_RIFT_CONFIG,
));

const GLOBAL_SENTINEL_RIFT_PROGRESS = Object.freeze({
  completed: true,
  failed: false,
  fracture: RIFT_FRACTURE,
  gamePhase: GLOBAL_SENTINEL_GAME_PHASES.FRACTURE_OPEN,
  progress: 1,
  protocolScope: 'global',
  protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
  sentinelIntegrity: 0,
  syncLevel: RIFT_SYNC_PRESSURE,
  syncPressure: RIFT_SYNC_PRESSURE,
  syncPressureRelief: 0,
  timeProgress: 1,
});

function MockArticlePage() {
  return (
    <main className="visual-global-rift-page" aria-hidden="true">
      <nav className="visual-global-rift-page__nav">
        <span className="visual-global-rift-page__brand">
          <span />
          ORBITAL REVIEW
        </span>
        <span>Field notes</span>
        <span>Objects</span>
        <span>Archive</span>
        <span className="visual-global-rift-page__avatar" />
      </nav>
      <section className="visual-global-rift-page__body">
        <article className="visual-global-rift-page__article">
          <span className="visual-global-rift-page__kicker">ISSUE 08 / LIMINAL SYSTEMS</span>
          <h1>Structures at the edge of attention</h1>
          <p>
            A field study of quiet interfaces, temporary thresholds, and the
            small decisions that return a drifting day to human scale.
          </p>
          <div className="visual-global-rift-page__byline">
            <span className="visual-global-rift-page__portrait" />
            <span><strong>Mina Seo</strong> · 12 minute read</span>
          </div>
        </article>
        <div className="visual-global-rift-page__hero" />
        <aside className="visual-global-rift-page__rail">
          <span className="visual-global-rift-page__rail-label">RELATED SIGNALS</span>
          <div className="visual-global-rift-page__rail-card is-blue"><span /><strong>Slow instruments</strong></div>
          <div className="visual-global-rift-page__rail-card is-coral"><span /><strong>Rooms for pause</strong></div>
        </aside>
      </section>
    </main>
  );
}

function assertRiftPlan(plan) {
  if (!plan?.active || !Array.isArray(plan.contour) || plan.contour.length < 3) {
    throw new Error('[VisualHarness] production global sentinel rift plan did not open.');
  }
  if (!plan.selectedNodes.every((node) => node.pointIndex === 1 || node.pointIndex === 2)) {
    throw new Error('[VisualHarness] global sentinel rift plan escaped crack nodes 1-2.');
  }
}

function drawProductionRift(canvas, bounds) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) {
    throw new Error('[VisualHarness] 2D canvas is unavailable for the global sentinel rift.');
  }

  canvas.width = bounds.width;
  canvas.height = bounds.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bounds.width, bounds.height);

  const plan = resolveGlobalSentinelRiftAperturePlan({
    impactPoint: SIMULATION_BREAK_IMPACT_POINT,
    progress: 1,
    seed: SIMULATION_BREAK_SEED,
    width: bounds.width,
    height: bounds.height,
  });
  assertRiftPlan(plan);

  const options = {
    fracture: RIFT_FRACTURE,
    renderBudget: NORMAL_RENDER_BUDGET,
    scenePhase: NUDGE_SCENE_PHASES.RIFT,
    simulationBreakEntryRevealActive: true,
    simulationBreakEntryRevealProgress: 1,
    simulationBreakImpactPoint: SIMULATION_BREAK_IMPACT_POINT,
    simulationBreakRiftProgress: 1,
    simulationBreakSeed: SIMULATION_BREAK_SEED,
    syncLevel: RIFT_SYNC_PRESSURE,
    syncPressure: RIFT_SYNC_PRESSURE,
    terminalSequence: null,
    timeMs: FIXED_TIME_MS,
  };
  const backgroundDrawn = drawNudgeProtocolSceneBackground(
    ctx,
    bounds,
    GLOBAL_SENTINEL_RIFT_SCENE,
    options,
  );
  const foregroundDrawn = drawNudgeProtocolSceneForeground(
    ctx,
    bounds,
    GLOBAL_SENTINEL_RIFT_SCENE,
    options,
  );
  if (!backgroundDrawn || !foregroundDrawn) {
    throw new Error('[VisualHarness] production global sentinel rift draw path was rejected.');
  }
  return plan;
}

function createRiftPresentationController(refs) {
  const activeTheme = resolveNudgeTheme('zen');
  return {
    activeTheme,
    controller: createSentinelProtocolPresentationController({
      getRefs: () => refs,
      getConfig: () => GLOBAL_SENTINEL_RIFT_CONFIG,
      getRuntimeContext: () => null,
      getActiveThemeId: () => 'zen',
      getActiveTheme: () => activeTheme,
      getScenePhase: () => NUDGE_SCENE_PHASES.RIFT,
      isModalOpen: () => false,
      resolveActiveProtocolProgress: () => GLOBAL_SENTINEL_RIFT_PROGRESS,
      createDefaultConfig: () => GLOBAL_SENTINEL_RIFT_CONFIG,
      syncRenderOptions: (presentation) => presentation,
      applyRuptureRevealPresentation: () => false,
    }),
  };
}

function GlobalSentinelRiftEntryScene({ signalReady }) {
  useLayoutEffect(() => {
    let riftEnterCount = 0;
    const overlayHost = new NudgeOverlayHost({
      onRiftEnter: () => {
        riftEnterCount += 1;
        overlayHost.root?.setAttribute('data-rift-enter-count', String(riftEnterCount));
      },
    });

    try {
      const refs = overlayHost.ensure();
      if (!refs.root || !refs.shadow || !refs.scene || !refs.canvas || !refs.riftInviteButton) {
        throw new Error('[VisualHarness] production nudge overlay did not expose the rift contract.');
      }

      refs.root.setAttribute('data-visual-scene', 'global-sentinel-rift-entry');
      refs.riftInviteButton.setAttribute(
        'data-visual-capture',
        'global-sentinel-rift-aperture',
      );
      refs.root.style.setProperty('--nudge-rift-auto-ms', `${SENTINEL_PROTOCOL_GLOBAL_RIFT_INVITE_MS}ms`);

      const { activeTheme, controller } = createRiftPresentationController(refs);
      controller.applyThemeVars(activeTheme);
      applyGlobalRiftTargetDom({
        root: refs.root,
        point: {
          xRatio: SIMULATION_BREAK_IMPACT_POINT.x,
          yRatio: SIMULATION_BREAK_IMPACT_POINT.y,
        },
      });
      overlayHost.setRiftInviteAriaLabel('틈을 눌러 잠시 쉬어가세요');
      overlayHost.setRiftInviteOpen(true);
      overlayHost.show();

      const bounds = {
        width: Math.max(1, Math.round(window.innerWidth)),
        height: Math.max(1, Math.round(window.innerHeight)),
      };
      const aperturePlan = drawProductionRift(refs.canvas, bounds);
      overlayHost.setRiftInviteGeometry({
        contour: aperturePlan.contour,
        width: bounds.width,
        height: bounds.height,
      });
      refs.riftInviteButton.focus({ preventScroll: true });
      if (refs.shadow.activeElement !== refs.riftInviteButton) {
        throw new Error('[VisualHarness] production rift invite did not retain focus.');
      }

      signalReady();
    } catch (error) {
      overlayHost.destroy();
      throw error;
    }

    return () => {
      overlayHost.destroy();
    };
  }, [signalReady]);

  return <MockArticlePage />;
}

export default defineVisualSceneImplementation({
  Component: GlobalSentinelRiftEntryScene,
});
