import React from 'react';
import { motion } from 'framer-motion';

import { ARTIFACT_MOTION_BUDGETS } from './artifactMotionBudget.js';
import { ArtifactRenderContextProvider } from './artifactRenderContext.js';
import { ARTIFACT_STAGE_SIZE } from './artifactStageGeometry.js';
export { ARTIFACT_STAGE_SIZE } from './artifactStageGeometry.js';

const DEFAULT_RENDERER_FX = Object.freeze({
  preserveBodyAppearance: false,
  activeGlow: true,
  activeGlowBlur: 30,
  activeScale: 1.1,
  inactiveScale: 1,
  inactiveOpacity: 0.4,
  inactiveGrayscale: 0.5,
  hoverRing: true,
  usesLocal3d: false,
  rotateY: Object.freeze({
    enabled: true,
    amplitude: 5,
    duration: 6,
  }),
  entryScale: 0.95,
  entryReveal: true,
});

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function lerp(start, end, t) {
  return start + ((end - start) * t);
}

export function resolveArtifactRendererFx(fx) {
  const source = fx && typeof fx === 'object' ? fx : {};
  const rotateYSource = source.rotateY && typeof source.rotateY === 'object'
    ? source.rotateY
    : {};
  return {
    ...DEFAULT_RENDERER_FX,
    ...source,
    rotateY: {
      ...DEFAULT_RENDERER_FX.rotateY,
      ...rotateYSource,
    },
  };
}

function ArtifactReady({ onReady, children }) {
  React.useEffect(() => {
    onReady?.();
  }, [onReady]);

  return children;
}

export default function ArtifactRenderStage({
  artifactColor,
  artifactRenderContext,
  presentationContext = artifactRenderContext,
  artifactRenderState,
  children,
  isComponentReady = true,
  onClick,
  onReady,
  rendererFx,
  managesReadiness = false,
  synchronousPresentation = false,
}) {
  const resolvedRendererFx = resolveArtifactRendererFx(rendererFx);
  const activityWeight = clamp01(artifactRenderState?.visualWeight);
  const motionBudgetMode = presentationContext?.motion?.budget?.mode
    || (artifactRenderState?.shouldAnimateMotion === true
      ? artifactRenderState?.motionMode || 'none'
      : ARTIFACT_MOTION_BUDGETS.still);
  const rotateYEnabled = Boolean(resolvedRendererFx.rotateY?.enabled)
    && motionBudgetMode === ARTIFACT_MOTION_BUDGETS.full;
  const usesLocal3d = resolvedRendererFx.usesLocal3d === true;
  // Body presentation is independent of motion admission and scene activity.
  const bodyEffectsEnabled = !usesLocal3d && resolvedRendererFx.preserveBodyAppearance !== true;
  const entryRevealEnabled = !usesLocal3d && resolvedRendererFx.entryReveal;
  const rotateYAmplitude = toFiniteNumber(resolvedRendererFx.rotateY?.amplitude, 0);
  const rotateYDuration = toFiniteNumber(resolvedRendererFx.rotateY?.duration, 6);
  const activeScale = toFiniteNumber(resolvedRendererFx.activeScale, 1.1);
  const inactiveScale = toFiniteNumber(resolvedRendererFx.inactiveScale, 1);
  const inactiveOpacity = toFiniteNumber(resolvedRendererFx.inactiveOpacity, 0.4);
  const inactiveGrayscale = toFiniteNumber(resolvedRendererFx.inactiveGrayscale, 0.5);
  const entryScale = toFiniteNumber(resolvedRendererFx.entryScale, 0.95);
  const activeFilter = resolvedRendererFx.activeGlow
    ? `drop-shadow(0 0 ${toFiniteNumber(resolvedRendererFx.activeGlowBlur, 30)}px var(--color-glow))`
    : 'none';
  const grayscaleAmount = inactiveGrayscale > 0
    ? inactiveGrayscale * (1 - activityWeight)
    : 0;
  const filterParts = [];
  if (bodyEffectsEnabled && grayscaleAmount > 0.001) {
    filterParts.push(`grayscale(${grayscaleAmount})`);
  }
  if (bodyEffectsEnabled && resolvedRendererFx.activeGlow && activityWeight > 0.55) {
    filterParts.push(activeFilter);
  }
  const visualStyle = {
    transform: bodyEffectsEnabled
      ? `scale(${lerp(inactiveScale, activeScale, activityWeight)})`
      : 'scale(1)',
    filter: filterParts.length ? filterParts.join(' ') : 'none',
    opacity: bodyEffectsEnabled ? lerp(inactiveOpacity, 1, activityWeight) : 1,
    transformOrigin: '50% 100%',
  };

  return (
    <div
      className="relative flex items-end justify-center overflow-visible cursor-pointer group"
      onClick={onClick}
      style={{
        color: artifactColor,
        '--artifact-color': artifactColor,
        width: `${ARTIFACT_STAGE_SIZE.width}px`,
        height: `${ARTIFACT_STAGE_SIZE.height}px`,
      }}
    >
      <motion.div
        initial={entryRevealEnabled ? { opacity: 0, scale: entryScale } : false}
        animate={{
          opacity: !entryRevealEnabled || isComponentReady ? 1 : 0,
          scale: !entryRevealEnabled || isComponentReady ? 1 : entryScale,
          rotateY: !usesLocal3d && rotateYEnabled
            ? [0, rotateYAmplitude, -rotateYAmplitude, 0]
            : 0,
        }}
        transition={{
          opacity: { duration: entryRevealEnabled ? 0.3 : 0, ease: 'easeOut' },
          scale: { duration: entryRevealEnabled ? 0.3 : 0, ease: 'easeOut' },
          rotateY: !usesLocal3d && rotateYEnabled
            ? { duration: rotateYDuration, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2, ease: 'easeOut' },
        }}
        className="relative z-20 w-full h-full flex items-end justify-center overflow-visible text-white"
        data-artifact-render-stage-space={usesLocal3d ? 'local-3d' : 'flat-2d'}
        data-artifact-render-stage-ready={isComponentReady ? 'true' : 'false'}
        style={{ transformOrigin: '50% 100%' }}
      >
        <div
          className="transition-all duration-500 flex items-end justify-center w-full h-full overflow-visible"
          data-artifact-render-stage-visual={usesLocal3d ? 'local-3d' : 'standard'}
          style={{ '--color-glow': artifactColor, ...visualStyle,
            transition: synchronousPresentation ? 'none' : undefined }}
        >
          <ArtifactRenderContextProvider value={artifactRenderContext}>
            <ArtifactReady onReady={managesReadiness ? undefined : onReady}>
              {children}
            </ArtifactReady>
          </ArtifactRenderContextProvider>
        </div>
      </motion.div>

      {resolvedRendererFx.hoverRing && (
        <div className="absolute inset-0 rounded-full border border-white/0 group-hover:border-white/10 transition-all duration-300 scale-90 group-hover:scale-100 pointer-events-none" />
      )}
    </div>
  );
}
