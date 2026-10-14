import {
  SHISHI_ODOSHI_DROP_Y as DROP_Y,
  SHISHI_ODOSHI_STAGE_HEIGHT,
  SHISHI_ODOSHI_STAGE_WIDTH,
  SHISHI_ODOSHI_ROCK_GEOMETRY as ROCK,
  SHISHI_ODOSHI_TUBE_HEIGHT as TUBE_HEIGHT,
  SHISHI_ODOSHI_TUBE_LEFT as TUBE_LEFT,
  SHISHI_ODOSHI_TUBE_TOP as TUBE_TOP,
  SHISHI_ODOSHI_TUBE_WIDTH as TUBE_WIDTH,
  SHISHI_ODOSHI_TUBE_PIVOT_X as PIVOT_X,
  SHISHI_ODOSHI_TUBE_PIVOT_Y as PIVOT_Y,
} from '../recipes/zenShishiOdoshiGeometry.js';
import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

import ArtifactSvgStage from '../../../../../core/artifacts/scene/ArtifactSvgStage.jsx';
import { createArtifactSvgViewBox } from '../../../../../core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { useArtifactSvgIdScope } from '../../../../../core/artifacts/scene/useArtifactSvgIdScope.js';
import {
  buildZenShishiOdoshiBackdropScene,
  buildZenShishiOdoshiForegroundScene,
  buildZenShishiOdoshiGroundRippleScene,
  buildZenShishiOdoshiLipSplashScene,
  buildZenShishiOdoshiLiquidStreamScene,
  buildZenShishiOdoshiRockScene,
  buildZenShishiOdoshiTubeScene,
} from '../recipes/zenShishiOdoshiSceneRecipe.jsx';

const STAGE_VIEW_BOX = createArtifactSvgViewBox(
  SHISHI_ODOSHI_STAGE_WIDTH,
  SHISHI_ODOSHI_STAGE_HEIGHT,
);
const TUBE_VIEW_BOX = createArtifactSvgViewBox(TUBE_WIDTH, TUBE_HEIGHT);
const REQUIRED_POSE_FIELDS = Object.freeze([
  'captureStemHeight',
  'captureTailLength',
  'captureTailOpacity',
  'captureTailRotate',
  'freeFallBaseOpacity',
  'freeFallCoreOpacity',
  'lipOpacity',
  'lipY',
  'ripple1Opacity',
  'ripple1ScaleX',
  'ripple1ScaleY',
  'ripple2Opacity',
  'ripple2ScaleX',
  'ripple2ScaleY',
  'ripple3Opacity',
  'ripple3ScaleX',
  'ripple3ScaleY',
  'rippleSplashOpacity',
  'rippleSplashScaleX',
  'rippleSplashScaleY',
  'rippleDropletOpacity',
  'streamBaseOpacity',
  'streamCoreOpacity',
  'streamSpread',
  'tubeFilter',
  'tubeRotate',
]);

function requirePose(pose) {
  if (!pose || typeof pose !== 'object') {
    throw new Error('ZEN_SHISHI_ODOSHI_SCENE_POSE_REQUIRED');
  }
  REQUIRED_POSE_FIELDS.forEach((field) => {
    if (pose[field] === null || pose[field] === undefined) {
      throw new Error(`ZEN_SHISHI_ODOSHI_SCENE_POSE_${field.toUpperCase()}_REQUIRED`);
    }
  });
  return pose;
}

function SceneLayer({ children, zIndex }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  );
}

function ZenShishiOdoshiScene({
  activityWeight,
  className = '',
  color,
  groundTiltDeg,
  groundAspect,
  lipSplashParticles,
  pose: sourcePose,
  shouldAnimateMotion,
  style,
}) {
  const idScope = useArtifactSvgIdScope('zen-shishi-odoshi-scene');
  const pose = requirePose(sourcePose);
  if (!Number.isFinite(activityWeight) || activityWeight < 0 || activityWeight > 1) {
    throw new Error('ZEN_SHISHI_ODOSHI_SCENE_ACTIVITY_WEIGHT_INVALID');
  }
  if (!Number.isFinite(groundTiltDeg)) {
    throw new Error('ZEN_SHISHI_ODOSHI_SCENE_GROUND_TILT_INVALID');
  }
  if (!Number.isFinite(groundAspect) || groundAspect <= 0 || groundAspect > 1.6) {
    throw new Error('ZEN_SHISHI_ODOSHI_SCENE_GROUND_ASPECT_INVALID');
  }
  if (typeof color !== 'string' || !color.trim()) {
    throw new Error('ZEN_SHISHI_ODOSHI_SCENE_COLOR_REQUIRED');
  }
  if (!Array.isArray(lipSplashParticles)) {
    throw new Error('ZEN_SHISHI_ODOSHI_SCENE_LIP_PARTICLES_REQUIRED');
  }

  const tubeScene = useMemo(
    () => buildZenShishiOdoshiTubeScene({ idScope }),
    [idScope],
  );
  const backdropScene = useMemo(
    () => buildZenShishiOdoshiBackdropScene({ idScope, groundTiltDeg, groundAspect }),
    [groundTiltDeg, groundAspect, idScope],
  );
  const rockScene = useMemo(
    () => buildZenShishiOdoshiRockScene({ idScope, groundAspect }),
    [groundAspect, idScope],
  );
  const foregroundScene = useMemo(
    () => buildZenShishiOdoshiForegroundScene({ idScope, groundTiltDeg, groundAspect }),
    [groundTiltDeg, groundAspect, idScope],
  );
  const groundRippleScene = useMemo(
    () => buildZenShishiOdoshiGroundRippleScene({
      idScope,
      groundTiltDeg,
      groundAspect,
      shouldAnimateMotion,
      rippleSplashOpacity: pose.rippleSplashOpacity,
      rippleSplashScaleX: pose.rippleSplashScaleX,
      rippleSplashScaleY: pose.rippleSplashScaleY,
      rippleDropletOpacity: pose.rippleDropletOpacity,
      ripple1Opacity: pose.ripple1Opacity,
      ripple1ScaleX: pose.ripple1ScaleX,
      ripple1ScaleY: pose.ripple1ScaleY,
      ripple2Opacity: pose.ripple2Opacity,
      ripple2ScaleX: pose.ripple2ScaleX,
      ripple2ScaleY: pose.ripple2ScaleY,
      ripple3Opacity: pose.ripple3Opacity,
      ripple3ScaleX: pose.ripple3ScaleX,
      ripple3ScaleY: pose.ripple3ScaleY,
    }),
    [groundTiltDeg, groundAspect, idScope, pose, shouldAnimateMotion],
  );
  const liquidStreamScene = useMemo(
    () => buildZenShishiOdoshiLiquidStreamScene({
      idScope,
      captureStemHeight: pose.captureStemHeight,
      streamSpread: pose.streamSpread,
      streamBaseOpacity: pose.streamBaseOpacity,
      streamCoreOpacity: pose.streamCoreOpacity,
      freeFallBaseOpacity: pose.freeFallBaseOpacity,
      freeFallCoreOpacity: pose.freeFallCoreOpacity,
      captureTailLength: pose.captureTailLength,
      captureTailRotate: pose.captureTailRotate,
      captureTailOpacity: pose.captureTailOpacity,
      shouldAnimateMotion: shouldAnimateMotion === true,
    }),
    [idScope, pose, shouldAnimateMotion],
  );
  const lipSplashScene = useMemo(
    () => buildZenShishiOdoshiLipSplashScene({
      idScope,
      lipY: pose.lipY,
      lipOpacity: pose.lipOpacity,
      lipSplashParticles,
      shouldAnimateMotion: shouldAnimateMotion === true,
    }),
    [idScope, lipSplashParticles, pose.lipOpacity, pose.lipY, shouldAnimateMotion],
  );
  const ambientGlowStyle = useMemo(() => ({
    background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${color} 13%, transparent) 0%, transparent 70%)`,
    opacity: 0.12 + (activityWeight * 0.33),
  }), [activityWeight, color]);
  const stageProps = {
    width: SHISHI_ODOSHI_STAGE_WIDTH,
    height: SHISHI_ODOSHI_STAGE_HEIGHT,
    viewBox: STAGE_VIEW_BOX,
    style: { width: '100%', height: '100%', overflow: 'visible' },
    'aria-hidden': true,
    focusable: 'false',
  };

  return (
    <div
      className={className}
      data-zen-shishi-scene="actual"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        userSelect: 'none',
        overflow: 'visible',
        ...style,
      }}
      aria-hidden="true"
    >
      <SceneLayer zIndex={0}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: 136,
              top: 245 + DROP_Y,
              width: 60,
              height: 20,
              borderRadius: 999,
              filter: 'blur(20px)',
              transform: 'scale(4, 1.5)',
              ...ambientGlowStyle,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: ROCK.contactX - 35,
              top: ROCK.contactY - 6,
              width: 70,
              height: 12,
              borderRadius: 999,
              background: 'rgb(28 25 23 / 0.3)',
              filter: 'blur(6px)',
            }}
          />
        </div>
      </SceneLayer>
      <SceneLayer zIndex={1}>
        <ArtifactSvgStage {...stageProps} defs={backdropScene.defs} nodes={backdropScene.nodes} />
      </SceneLayer>
      <SceneLayer zIndex={2}>
        <ArtifactSvgStage {...stageProps} defs={rockScene.defs} nodes={rockScene.nodes} />
      </SceneLayer>
      <SceneLayer zIndex={1}>
        <ArtifactSvgStage {...stageProps} defs={groundRippleScene.defs} nodes={groundRippleScene.nodes} />
      </SceneLayer>
      <SceneLayer zIndex={30}>
        <ArtifactSvgStage {...stageProps} defs={foregroundScene.defs} nodes={foregroundScene.nodes} />
      </SceneLayer>
      <SceneLayer zIndex={14}>
        <ArtifactSvgStage {...stageProps} defs={liquidStreamScene.defs} nodes={liquidStreamScene.nodes} />
      </SceneLayer>
      <SceneLayer zIndex={16}>
        <ArtifactSvgStage {...stageProps} defs={lipSplashScene.defs} nodes={lipSplashScene.nodes} />
      </SceneLayer>
      <motion.div
        style={{
          position: 'absolute',
          zIndex: 12,
          top: TUBE_TOP,
          left: TUBE_LEFT,
          width: TUBE_WIDTH,
          height: TUBE_HEIGHT,
          transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`,
          rotate: pose.tubeRotate,
          filter: pose.tubeFilter,
        }}
      >
        <ArtifactSvgStage
          width={TUBE_WIDTH}
          height={TUBE_HEIGHT}
          viewBox={TUBE_VIEW_BOX}
          style={{ overflow: 'visible' }}
          defs={tubeScene.backDefs}
          nodes={tubeScene.backNodes}
          aria-hidden="true"
          focusable="false"
        />
      </motion.div>
      <motion.div
        style={{
          position: 'absolute',
          zIndex: 15,
          top: TUBE_TOP,
          left: TUBE_LEFT,
          width: TUBE_WIDTH,
          height: TUBE_HEIGHT,
          transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`,
          rotate: pose.tubeRotate,
          filter: pose.tubeFilter,
        }}
      >
        <ArtifactSvgStage
          width={TUBE_WIDTH}
          height={TUBE_HEIGHT}
          viewBox={TUBE_VIEW_BOX}
          style={{ overflow: 'visible' }}
          defs={tubeScene.frontDefs}
          nodes={tubeScene.frontNodes}
          aria-hidden="true"
          focusable="false"
        />
      </motion.div>
    </div>
  );
}

export default memo(ZenShishiOdoshiScene);
