import { ZEN_FURIN_GEOMETRY as g, projectZenFurinPose } from '../../../widgets/tools/recipes/zenFurinGeometry.js';
import { BLEND_MODES, Container, Matrix, SimplePlane, Sprite } from '../../../runtime/worker/zenPixiWorkerRuntime.js';
import { ZEN_FURIN_PAPER_BOUNDS, ZEN_FURIN_PAPER_ROWS, projectZenFurinPaperOffset } from '../../../widgets/tools/recipes/zenFurinPaper.js';
import { projectZenFurinImpact } from '../../../widgets/tools/recipes/zenFurinImpact.js';
import { createFurinPhysicsState, resolveFurinSimulationRecipe, stepFurinPhysics } from '../../../widgets/tools/recipes/zenFurinRuntimeRecipe.js';
import { createZenRaster } from './zenMaterialRaster.js';
import { createZenLiveSimulationClock } from './zenLiveSimulationClock.js';
import { createZenSimulationClock } from './zenSimulationClock.js';
import { zenEaseInOut } from './zenArtifactTiming.js';

function createPaperMesh(assets, name) {
  const mesh = new SimplePlane(assets.material(name), 2, ZEN_FURIN_PAPER_ROWS.length);
  mesh.autoResize = false;
  const uv = mesh.geometry.getBuffer('aTextureCoord');
  ZEN_FURIN_PAPER_ROWS.forEach((y, row) => {
    const v = (y - ZEN_FURIN_PAPER_BOUNDS[1]) / ZEN_FURIN_PAPER_BOUNDS[3];
    uv.data.set([0, v, 1, v], row * 4);
  });
  uv.update();
  return mesh;
}

function bendPaperMesh(mesh, skew) {
  const vertices = mesh.geometry.getBuffer('aVertexPosition');
  const left = ZEN_FURIN_PAPER_BOUNDS[0] - g.paperWidth / 2;
  ZEN_FURIN_PAPER_ROWS.forEach((y, row) => {
    const x = left + projectZenFurinPaperOffset(skew, y);
    vertices.data.set([x, y, x + ZEN_FURIN_PAPER_BOUNDS[2], y], row * 4);
  });
  vertices.update();
}

export function createZenFurinClock(isActive) {
  const recipe = resolveFurinSimulationRecipe({ activityWeight: 1, isSimulationLive: isActive, simulationMode: isActive ? 'live' : 'halt' });
  return createZenSimulationClock({ createState: createFurinPhysicsState,
    step: (state, simStepMs, simTimeMs) => stepFurinPhysics({ state, simStepMs, simTimeMs, recipe }),
  });
}

export async function createZenFurinScene({ color, isActive, mantra, assets, resolution }) {
  const root = new Container();
  const stage = new Container(); root.addChild(stage); stage.position.set(-150, -250);
  const clock = createZenFurinClock(isActive);
  let runtime = null, liveClock = null, liveRecipe = null;
  let simulationTimeMs = 0;
  let physicalState = createFurinPhysicsState();
  try {
    const bake = name => assets.sprite(name);
    const glow = bake('glow');
    const glowRoot = new Container(); glowRoot.position.set(g.supportX, g.supportY + g.bellCenterY); glow.position.set(-120, -120);
    glowRoot.addChild(glow); glow.blendMode = BLEND_MODES.SCREEN; stage.addChild(glowRoot);
    stage.addChild(bake('support'));
    const hanger = new Container(); hanger.position.set(g.supportX, g.supportY); stage.addChild(hanger);
    hanger.addChild(bake('main'));
    const koi = bake('koi');
    hanger.addChild(koi);
    const shimmer = bake('shimmer');
    hanger.addChild(shimmer);
    const striker = new Container(); striker.position.set(0, g.strikerPivotY); hanger.addChild(striker);
    striker.addChild(bake('striker'));
    const paper = new Container(); paper.position.set(0, g.strikerLength); striker.addChild(paper);
    paper.addChild(bake('cord'));
    const torsion = new Container(); torsion.position.set(0, g.paperCordLength); paper.addChild(torsion);
    const torsionMatrix = new Matrix();
    const frontSprite = createPaperMesh(assets, 'front');
    const backSprite = createPaperMesh(assets, 'back');
    torsion.addChild(frontSprite, backSprite);
    const pulse = bake('pulse');
    pulse.pivot.set(30, 30); hanger.addChild(pulse);
    hanger.addChild(bake('rim'));
    const particleTexture = assets.texture(createZenRaster(16, 16, resolution, (ctx) => {
      ctx.filter = `blur(${resolution}px)`; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(8, 8, 2, 0, Math.PI * 2); ctx.fill();
    }));
    const particles = Array.from({ length: isActive ? 6 : 0 }, () => {
      const sprite = new Sprite(particleTexture); sprite.anchor.set(0.5);
      sprite.blendMode = BLEND_MODES.SCREEN; stage.addChild(sprite); return sprite;
    });
    return {
      root, geometry: { sprites: 9 + particles.length, meshes: 2, liveFilters: 0, simulation: 'fixed joints / 240 Hz constrained angular chain', paperFaces: 2 },
      configure(presentation, continuity) {
        runtime = presentation;
        if (!runtime) return;
        liveClock = continuity || createZenLiveSimulationClock(createFurinPhysicsState);
        if (runtime.simulationMode === 'halt') liveClock.reset();
        liveRecipe = resolveFurinSimulationRecipe(runtime);
      },
      continuity: () => liveClock,
      inspect: () => ({ angles: [hanger.angle, striker.angle, paper.angle],
        simulationMode: runtime ? runtime.simulationMode : isActive ? 'live' : 'halt', simulationTimeMs,
        windMult: runtime ? liveRecipe.windMult : resolveFurinSimulationRecipe({ activityWeight: 1, isSimulationLive: isActive }).windMult,
        paintedKoiLocal: { x: koi.x, y: koi.y },
        paperFlex: physicalState.paper.skew, paperYaw: physicalState.paper.yaw,
        impactCount: physicalState.impactCount, impact: projectZenFurinImpact(physicalState),
        hanger: Array.from(hanger.worldTransform.toArray()), striker: Array.from(striker.worldTransform.toArray()),
        paper: Array.from(paper.worldTransform.toArray()), }),
      update(atMs) {
        const state = runtime ? liveClock.at(atMs, (value, dt, time) => stepFurinPhysics({
          state: value, simStepMs: dt, simTimeMs: time, recipe: liveRecipe,
        }), runtime.shouldRunSimulation) : clock.at(isActive ? atMs : 0);
        simulationTimeMs = state.simTimeMs;
        physicalState = state;
        const ambient = runtime ? runtime.shouldAnimateAmbient : isActive;
        const weight = runtime ? runtime.visualWeight : 1;
        const pose = projectZenFurinPose(state);
        hanger.angle = pose.bellAngle;
        striker.angle = pose.strikerAngle;
        paper.angle = pose.paperAngle;
        torsionMatrix.set(pose.paperScaleX, 0, 0, 1, 0, g.paperCordLength);
        torsion.transform.setFromMatrix(torsionMatrix);
        bendPaperMesh(frontSprite, state.paper.skew);
        bendPaperMesh(backSprite, state.paper.skew);
        frontSprite.visible = pose.paperFront; backSprite.visible = !pose.paperFront;
        // Painted on the glass: retain the material's local position. Only the
        // parent bell moves; a second fish animation cannot masquerade as wind.
        koi.alpha = .7;
        shimmer.alpha = state.shimmer;
        const breath = (1 - Math.cos(atMs * Math.PI * 2 / 6000)) / 2;
        glowRoot.scale.set(ambient ? 1 + 0.08 * breath : 1);
        glow.alpha = (ambient ? 0.045 + 0.015 * breath : 0.045) * weight;
        const impact = projectZenFurinImpact(state);
        pulse.position.set(impact.x, impact.y);
        pulse.scale.set(impact.scale); pulse.alpha = impact.opacity;
        particles.forEach((sprite, i) => {
          const duration = (3.5 + i % 2) * 1000;
          const phase = Math.max(0, atMs - i * 450) % duration / duration;
          const eased = zenEaseInOut(phase);
          sprite.position.set(g.supportX + (i - 2.5) * 50 * eased,
            g.supportY + g.strikerPivotY + g.strikerLength + 120 + (180 + i * 10) * eased);
          sprite.alpha = ambient ? 0.22 * Math.sin(phase * Math.PI) * weight : 0;
          sprite.scale.set((i % 3 + 1) / 2 * (phase < 0.5 ? 0.5 + 1.4 * phase : 2.4 * (1 - phase)));
        });
      },
    };
  } catch (failure) { root.destroy({ children: true }); throw failure; }
}
