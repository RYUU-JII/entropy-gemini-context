import React, { useLayoutEffect, useMemo } from 'react';
import { useMotionValue } from 'framer-motion';
import ZenFurinScene from '../../../widgets/tools/presentation/ZenFurinScene.jsx';
import ZenShishiOdoshiScene from '../../../widgets/tools/presentation/ZenShishiOdoshiScene.jsx';
import { SHISHI_ODOSHI_SCENE_OFFSET_Y, SHISHI_ODOSHI_GROUND_VIEW } from '../../../widgets/tools/recipes/zenShishiOdoshiGeometry.js';
import { createZenFurinClock } from './zenFurinScene.js';
import { projectZenFurinImpact } from '../../../widgets/tools/recipes/zenFurinImpact.js';
import { createZenShishiClock, zenShishiReferencePose } from './zenShishiOdoshiScene.js';

// Development comparison composition, using the production presentation and
// canonical simulation at an explicit time. It does not mount a business
// controller, emit gate events, or implement a second physics model.
export default function ZenKineticArtifactReference({ descriptor, atMs }) {
  const state = useMemo(() => descriptor.id === 'furin'
    ? createZenFurinClock(descriptor.isActive).at(atMs)
    : createZenShishiClock(descriptor.isActive).at(atMs), [descriptor, atMs]);
  const main = useMotionValue(0), striker = useMotionValue(0), paper = useMotionValue(0);
  const yaw = useMotionValue(0), skew = useMotionValue(0), shimmer = useMotionValue(0);
  useLayoutEffect(() => {
    if (descriptor.id !== 'furin') return undefined;
    main.set(state.bell.pos); striker.set(state.striker.pos - state.bell.pos);
    paper.set(state.paper.pos - state.striker.pos); yaw.set(state.paper.yaw);
    skew.set(state.paper.skew); shimmer.set(state.shimmer);
  }, [descriptor, state, main, striker, paper, yaw, skew, shimmer]);
  const impact = descriptor.id === 'furin' ? projectZenFurinImpact(state) : null;
  if (descriptor.id === 'furin') return <div style={{ width: 300, height: 360, transform: 'translateY(-70px)' }}>
    <ZenFurinScene color={descriptor.color} mantra={descriptor.mantra} ambientVisualWeight={1}
      isSimulationLive={descriptor.isActive} mainRotation={main}
      strikerRotation={striker}
      paperRotation={paper} paperYaw={yaw} paperSkew={skew}
      bellShimmer={shimmer} impactX={impact.x} impactScale={impact.scale} impactOpacity={impact.opacity}
      shouldRunSimulation={false} shouldAnimateVisual={false} shouldAnimateAmbientGlow={false} />
  </div>;
  return <ZenShishiOdoshiScene activityWeight={1} color={descriptor.color}
    groundTiltDeg={SHISHI_ODOSHI_GROUND_VIEW.tiltDeg} groundAspect={SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect}
    lipSplashParticles={[]} pose={zenShishiReferencePose(state.frame)}
    shouldAnimateMotion={false}
    style={{ width: 320, height: 320, transform: `translateY(${SHISHI_ODOSHI_SCENE_OFFSET_Y}px)` }} />;
}
