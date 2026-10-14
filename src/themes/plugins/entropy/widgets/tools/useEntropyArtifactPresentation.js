import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { ARTIFACT_RENDER_PIPELINE_VERSION } from '@/themes/core/tools/artifactRenderContext.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRatio = value => Number.isFinite(value) && value >= 0 && value <= 1;

function requireEntropyArtifactContext(context, familyId, isEnabled) {
  if (!isRecord(context) || context.version !== ARTIFACT_RENDER_PIPELINE_VERSION
    || context.themeId !== 'entropy' || context.artifactId !== familyId) {
    throw new Error(`ENTROPY_ARTIFACT_CONTEXT_REQUIRED:${familyId}`);
  }
  if (!isRecord(context.material) || !isRatio(context.material.visualWeight)
    || typeof context.material.signatureColor !== 'string' || !context.material.signatureColor.trim()
    || !isRecord(context.renderState) || typeof context.renderState.reducedMotion !== 'boolean'
    || !isRecord(context.motion?.budget) || typeof context.motion.budget.shouldAnimate !== 'boolean'
    || !['still', 'ambient', 'full'].includes(context.motion.budget.mode)
    || !isRecord(context.activity) || typeof context.activity.configuredActive !== 'boolean'
    || typeof context.activity.isRuntimeActive !== 'boolean' || typeof isEnabled !== 'boolean') {
    throw new Error(`ENTROPY_ARTIFACT_CHANNELS_INVALID:${familyId}`);
  }
  if (!isRecord(context.visualState) || !isRecord(context.visualState.children)) {
    throw new Error(`ENTROPY_ARTIFACT_CHILD_PROJECTION_REQUIRED:${familyId}`);
  }
}

// Configuration and runtime admission stay with the card/activity owners. This
// adapter consumes their projection without subscribing to stores or clocks.
export function useEntropyArtifactPresentation({ artifactRenderContext, familyId, isEnabled = true }) {
  requireEntropyArtifactContext(artifactRenderContext, familyId, isEnabled);
  const channels = useArtifactRenderChannels({ artifactRenderContext });
  const shouldAnimateMotion = isEnabled && channels.shouldAnimateMotion && !channels.renderState.reducedMotion;
  return {
    familyId,
    channels,
    accent: channels.color,
    signalOpacity: 0.14 + channels.visualWeight * 0.76,
    motionGain: channels.isMotionFull ? 1 : 0.35,
    shouldAnimateMotion,
    childRatio(childId) {
      const child = channels.visualState.children[childId];
      if (!isRecord(child) || typeof child.enabled !== 'boolean' || !isRatio(child.ratio)) {
        throw new Error(`ENTROPY_ARTIFACT_CHILD_PROJECTION_INVALID:${familyId}:${childId}`);
      }
      return child.ratio;
    },
    motionProps(animated, still, duration = 8) {
      return {
        initial: still,
        animate: shouldAnimateMotion ? animated : still,
        transition: { duration: shouldAnimateMotion ? duration : 0,
          repeat: shouldAnimateMotion ? Infinity : 0, delay: 0, ease: 'easeInOut' },
      };
    },
  };
}
