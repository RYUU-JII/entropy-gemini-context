import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { ARTIFACT_RENDER_PIPELINE_VERSION } from '@/themes/core/tools/artifactRenderContext.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRatio = value => Number.isFinite(value) && value >= 0 && value <= 1;

function requireSCPArtifactContext(context, familyId, isEnabled) {
  if (!isRecord(context) || context.version !== ARTIFACT_RENDER_PIPELINE_VERSION
    || context.themeId !== 'scp' || context.artifactId !== familyId) {
    throw new Error(`SCP_ARTIFACT_RENDER_CONTEXT_REQUIRED:${familyId}`);
  }
  if (!isRecord(context.material) || !isRatio(context.material.visualWeight)
    || typeof context.material.signatureColor !== 'string' || !context.material.signatureColor.trim()
    || !isRecord(context.renderState) || typeof context.renderState.reducedMotion !== 'boolean'
    || typeof context.renderState.shouldAnimateMotion !== 'boolean'
    || !isRecord(context.motion?.budget) || typeof context.motion.budget.shouldAnimate !== 'boolean'
    || !['still', 'ambient', 'full'].includes(context.motion.budget.mode)
    || !isRecord(context.activity) || typeof context.activity.configuredActive !== 'boolean'
    || typeof context.activity.isRuntimeActive !== 'boolean' || typeof isEnabled !== 'boolean') {
    throw new Error(`SCP_ARTIFACT_RENDER_CHANNELS_INVALID:${familyId}`);
  }
  if (!isRecord(context.visualState) || !isRecord(context.visualState.children)) {
    throw new Error(`SCP_ARTIFACT_CHILD_PROJECTION_REQUIRED:${familyId}`);
  }
}

export function useSCPArtifactPresentation({ artifactRenderContext, familyId, isEnabled = true }) {
  requireSCPArtifactContext(artifactRenderContext, familyId, isEnabled);
  const channels = useArtifactRenderChannels({ artifactRenderContext });
  const shouldAnimateMotion = isEnabled && channels.shouldAnimateMotion && !channels.renderState.reducedMotion;
  const motionGain = channels.isMotionFull ? 1 : 0.35;

  return {
    channels,
    familyId,
    accent: channels.color,
    visualWeight: channels.visualWeight,
    signalOpacity: 0.18 + channels.visualWeight * 0.82,
    shouldAnimateMotion,
    motionGain,
    childRatio(childKey) {
      // This is configured mechanical posture, never runtime admission or an
      // operation count. Every family publishes this through its card schema.
      const child = channels.visualState.children[childKey];
      if (!isRecord(child) || typeof child.enabled !== 'boolean' || !isRatio(child.ratio)) {
        throw new Error(`SCP_ARTIFACT_CHILD_PROJECTION_INVALID:${familyId}:${childKey}`);
      }
      return child.ratio;
    },
    // Every looping key supplies its scalar retained state here. Parking also
    // cancels the transition itself, so an old repeat cannot survive a tab exit.
    motionProps(animated, still, duration = 6, ease = 'easeInOut') {
      return {
        initial: still,
        animate: shouldAnimateMotion ? animated : still,
        transition: { duration: shouldAnimateMotion ? duration : 0,
          repeat: shouldAnimateMotion ? Infinity : 0, delay: 0, ease },
      };
    },
  };
}
