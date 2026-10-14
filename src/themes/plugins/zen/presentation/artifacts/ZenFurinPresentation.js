import { ZEN_FURIN_GEOMETRY as g, projectZenFurinPose } from '../../widgets/tools/recipes/zenFurinGeometry.js';
import { createZenFurinVector } from './engine/zenFurinVector.js';
import { zenSvgDocument } from './engine/zenSvgDocument.jsx';
import { createFurinPhysicsState, resolveFurinSimulationRecipe, stepFurinPhysics } from '../../widgets/tools/recipes/zenFurinRuntimeRecipe.js';
import { projectZenFurinPaperBand } from '../../widgets/tools/recipes/zenFurinPaper.js';
import { projectZenFurinImpact } from '../../widgets/tools/recipes/zenFurinImpact.js';
import { createZenFurinInk } from './zenFurinInk.js';
import { selectZenFurinInscription } from '../../widgets/tools/recipes/zenFurinInscriptions.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Exact artifact geometry and coupled pendulum physics. Input and the canonical
// host frame own every update; this presenter has no timer or input listeners.
export function createZenFurinPresentation({ container, reducedMotion = false, random = Math.random }) {
  if (!container?.isConnected) throw new Error('zen_furin_container_required');
  // Draw before revealing anything, once per mounted presentation. Gesture
  // previews, cancellation and failed-close retries retain this inscription.
  const inscription = selectZenFurinInscription(random());
  const source = zenSvgDocument(createZenFurinVector({
    color: '#bd6552', mantra: [], scope: 'zen-ritual-furin', supportStyle: 'thread',
  }), [0, 0, 300, 360]);
  const svg = container.ownerDocument.importNode(source.documentElement, true);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.cssText = 'display:block;width:100%;height:100%;overflow:visible;pointer-events:none';
  container.appendChild(svg);
  const requireNode = selector => {
    const node = svg.querySelector(selector);
    if (!node) throw new Error(`zen_furin_joint_missing:${selector}`);
    return node;
  };
  const hanger = requireNode('[data-zen-furin-hanger-motion]');
  const striker = requireNode('[data-zen-furin-striker-motion]');
  const paper = requireNode('[data-zen-furin-paper-motion]');
  const leaf = requireNode('[data-zen-furin-paper-leaf-motion]');
  const pulse = requireNode('[data-zen-furin-impact-motion]');
  const paperBands = svg.querySelectorAll('[data-zen-furin-paper-band]');
  const shimmerNodes = svg.querySelectorAll('[data-zen-furin-shimmer]');
  const ink = createZenFurinInk(svg, { characters: inscription.characters.join(''), reducedMotion });
  for (const joint of [hanger, striker, paper, leaf]) {
    joint.style.removeProperty('transform');
    joint.style.transformOrigin = '0px 0px';
  }
  const state = createFurinPhysicsState();
  const releaseRecipe = resolveFurinSimulationRecipe({ simulationMode: 'halt', isSimulationLive: false });
  const recipe = { ...releaseRecipe,
    dampBell: 1.15, dampStriker: 1.6, dampPaper: 2.6 };
  let accumulatedMs = 0, presentationMs = 0, elapsedMs = 0;
  let disposed = false, arrived = false;
  let previewWind = 0, appliedWind = 0, direction = 1;
  let rewardArmed = false, rewardOngoing = false, rewardChimeCount = 0;
  let breezeMs = null, inkProgress = 0;
  let descent = -28, descentVelocity = 0;
  // Release a gently tilted hanging assembly; arrival never rings or inscribes.
  if (!reducedMotion) { state.bell.pos = -3; state.striker.pos = -3; state.paper.pos = -12; }

  function frame({ frameMs, progress }) {
    if (disposed) throw new Error('zen_furin_disposed');
    const dt = clamp(frameMs, 0, 50);
    elapsedMs += dt;
    let chime = false;
    if (!arrived && progress.visibleElapsedMs >= progress.arrivalMs) {
      arrived = true;
    }
    if (rewardArmed && progress.exitChoice === 'leave'
      && (!Number.isFinite(progress.exitElapsedMs) || progress.exitElapsedMs < 0
        || !Number.isFinite(progress.exitDurationMs) || progress.exitDurationMs <= 0)) {
      throw new Error('zen_furin_exit_progress_invalid');
    }
    rewardOngoing = rewardArmed && progress.exitChoice === 'leave'
      && progress.exitElapsedMs < progress.exitDurationMs;
    breezeMs = rewardArmed && progress.exitChoice === 'leave' ? progress.exitElapsedMs : null;
    inkProgress = breezeMs === null ? 0 : clamp((breezeMs - 100) / (reducedMotion ? 550 : 1350), 0, 1);
    ink.render(inkProgress);
    if (!reducedMotion) {
      accumulatedMs += dt;
      while (accumulatedMs >= 16) {
        accumulatedMs -= 16; presentationMs += 16;
        const entranceBreeze = presentationMs < 900 ? 0.8 * Math.sin(Math.PI * presentationMs / 900) : 0;
        // Gesture samples die away while the hand is stationary. A committed
        // release has fixed strength, independent of swipe distance or speed.
        previewWind *= Math.exp(-0.016 * 12);
        if (Math.abs(previewWind) < 0.001) previewWind = 0;
        const rewardWind = rewardOngoing
          ? direction * 2 * (breezeMs < 1400 ? 1 : clamp((1800 - breezeMs) / 400, 0, 1))
          : 0;
        appliedWind = rewardArmed ? rewardWind : entranceBreeze + previewWind * 0.7;
        // The release uses the shared free-swing damping. Heavier idle damping
        // keeps arrival/preview brief; no clapper angle or velocity is injected.
        stepFurinPhysics({ state, simStepMs: 16, recipe: rewardOngoing ? releaseRecipe : recipe,
          windInput: appliedWind, onImpact: () => {
            if (rewardOngoing && rewardChimeCount < 2) { chime = true; rewardChimeCount += 1; }
          } });
        const step = 0.016;
        const force = -95 * descent - 14 * descentVelocity;
        descentVelocity += force * step;
        descent += descentVelocity * step;
      }
    } else { descent = 0; }
    container.style.transform = `translate3d(0,${descent.toFixed(3)}px,0)`;
    container.style.opacity = String(reducedMotion ? 1 : 0.2 + 0.8 * Math.min(1, elapsedMs / 260));
    hanger.style.opacity = String(reducedMotion ? 1 : clamp(elapsedMs / 260, 0, 1));
    const pose = projectZenFurinPose(state);
    // Explicit user-space transforms; a child changing width cannot move a tie.
    hanger.setAttribute('transform', `rotate(${pose.bellAngle})`);
    striker.setAttribute('transform', `rotate(${pose.strikerAngle})`);
    paper.setAttribute('transform', `rotate(${pose.paperAngle})`);
    leaf.setAttribute('transform', `matrix(${pose.paperScaleX} 0 0 1 ${g.paperWidth / 2 * (1 - pose.paperScaleX)} 0)`);
    paperBands.forEach(node => {
      node.style.removeProperty('transform');
      node.setAttribute('transform', projectZenFurinPaperBand(state.paper.skew, Number(node.getAttribute('data-zen-furin-paper-band'))));
    });
    leaf.children[0].style.opacity = pose.paperFront ? '1' : '0';
    leaf.children[1].style.opacity = pose.paperFront ? '0' : '1';
    shimmerNodes.forEach(node => { node.style.opacity = String(rewardOngoing ? state.shimmer : 0); });
    const impact = projectZenFurinImpact(state);
    pulse.style.removeProperty('transform');
    pulse.setAttribute('transform', `translate(${impact.x} 0) scale(${impact.scale})`);
    pulse.style.opacity = String(rewardOngoing ? impact.opacity : 0);
    return { chime, pose, inkProgress, rewardChimeCount, impact, inscriptionId: inscription.id };
  }

  return { frame,
    setWind(value) {
      if (disposed) throw new Error('zen_furin_disposed');
      if (!Number.isFinite(value) || value < -1 || value > 1) throw new Error('zen_furin_wind_invalid');
      if (!rewardArmed && !reducedMotion) previewWind = value;
    },
    blow({ direction: releaseDirection = 1 } = {}) {
      if (disposed) throw new Error('zen_furin_disposed');
      if (releaseDirection !== -1 && releaseDirection !== 1) throw new Error('zen_furin_wind_direction_invalid');
      direction = releaseDirection;
      previewWind = 0; rewardArmed = true; rewardOngoing = true; rewardChimeCount = 0;
    },
    cancelBreeze() {
      previewWind = 0; appliedWind = 0; rewardArmed = false; rewardOngoing = false;
      rewardChimeCount = 0; breezeMs = null; inkProgress = 0;
      state.shimmer = 0; ink.render(0); pulse.style.opacity = '0';
      shimmerNodes.forEach(node => { node.style.opacity = '0'; });
    },
    isSettled: () => !rewardOngoing && previewWind === 0 && (reducedMotion || (arrived && elapsedMs > 2500
      && Math.abs(descent) < 0.05 && Math.abs(descentVelocity) < 0.1
      && [state.bell, state.paper, state.striker].every(j => Math.abs(j.pos) < 0.15 && Math.abs(j.vel) < 0.15)
      && Math.abs(state.paper.yaw) < 0.15 && Math.abs(state.paper.yawVel) < 0.15
      && Math.abs(state.paper.skew) < 0.05 && Math.abs(state.paper.skewVel) < 0.05)),
    snapshot: () => ({ renderer: 'artifact_furin_svg', elapsedMs, inscriptionId: inscription.id,
      bellAngle: state.bell.pos, strikerAngle: state.striker.pos, paperAngle: state.paper.pos,
      impactCount: state.impactCount, lastImpactAt: state.lastImpactAt, pose: projectZenFurinPose(state), descent, reducedMotion,
      paperYaw: state.paper.yaw, paperFlex: state.paper.skew, impact: projectZenFurinImpact(state),
      lastImpactSide: state.lastImpactSide, lastImpactStrength: state.lastImpactStrength,
      choiceBreezeMs: breezeMs, inkProgress, previewWind, appliedWind, rewardChimeCount }),
    dispose() { disposed = true; svg.remove(); },
  };
}
